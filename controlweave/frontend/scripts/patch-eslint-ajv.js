#!/usr/bin/env node
/**
 * Patches ESLint's ajv.js to work with ajv 8.x
 */

const fs = require('fs');
const path = require('path');

const ajvFilePath = path.join(__dirname, '..', 'node_modules', 'eslint', 'lib', 'shared', 'ajv.js');

if (!fs.existsSync(ajvFilePath)) {
  console.log('ESLint ajv.js not found, skipping patch');
  process.exit(0);
}

const originalContent = fs.readFileSync(ajvFilePath, 'utf8');

// Check if already patched
if (originalContent.includes('PATCHED FOR AJV 8')) {
  console.log('ESLint ajv.js already patched for ajv 8.x compatibility');
  process.exit(0);
}

// Create patched version that works with both ajv 6 and ajv 8
const patchedContent = `/**
 * @fileoverview The instance of Ajv validator.
 * @author Evgeny Poberezkin
 * PATCHED FOR AJV 8.x COMPATIBILITY
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const Ajv = require("ajv");

// Try to load draft-04 schema, fallback if not available
let metaSchema;
try {
	metaSchema = require("ajv/lib/refs/json-schema-draft-04.json");
} catch (e) {
	// For ajv 8.x, use draft-07 which is similar enough
	try {
		metaSchema = require("ajv/lib/refs/json-schema-draft-07.json");
	} catch (e2) {
		console.warn("Could not load JSON schema meta-schema");
		metaSchema = { id: "http://json-schema.org/draft-07/schema#" };
	}
}

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

module.exports = (additionalOptions = {}) => {
	// Ajv 8.x uses different option names
	const ajvOptions = {
		meta: false,
		useDefaults: true,
		validateSchema: false,
		verbose: true,
		...additionalOptions,
	};
	
	// ajv 6.x specific options
	if (Ajv.prototype.addMetaSchema) {
		ajvOptions.missingRefs = "ignore";
		ajvOptions.schemaId = "auto";
	}
	// ajv 8.x uses strict mode options differently
	else {
		ajvOptions.strict = false;
		ajvOptions.validateFormats = false;
	}

	const ajv = new Ajv(ajvOptions);

	// Add meta schema if method exists
	if (typeof ajv.addMetaSchema === 'function' && metaSchema) {
		try {
			ajv.addMetaSchema(metaSchema);
			// Only set defaultMeta if _opts exists (ajv 6.x)
			if (ajv._opts && metaSchema.id) {
				ajv._opts.defaultMeta = metaSchema.id;
			}
		} catch (e) {
			// Silently fail if meta schema addition doesn't work
			console.warn("Could not add meta schema:", e.message);
		}
	}

	return ajv;
};
`;

// Write patched version
fs.writeFileSync(ajvFilePath, patchedContent);
console.log('Successfully patched ESLint ajv.js for ajv 8.x compatibility');
