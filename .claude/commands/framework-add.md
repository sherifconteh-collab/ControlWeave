# Add Compliance Framework

Guide for adding a new compliance framework to ControlWeaver with controls and crosswalk mappings.

## Input

$ARGUMENTS — Framework name and details (e.g., "CMMC Level 2 with NIST 800-171 crosswalks")

## Steps

1. **Research the framework**
   - Identify official control catalog (control IDs, titles, descriptions, families)
   - Determine crosswalk relationships to existing frameworks (NIST 800-53, ISO 27001, SOC 2, etc.)
   - Note any domain-specific requirements (e.g., CUI handling for CMMC)

2. **Create the seed script**
   - Location: `controlweave/backend/scripts/seed-<framework-name>.js`
   - Use kebab-case for the script filename
   - Follow existing seed pattern from `scripts/seed-frameworks.js`

3. **Seed script template**
   ```javascript
   const pool = require('../src/config/database');

   const FRAMEWORK = {
     code: 'FRAMEWORK_CODE',
     name: 'Framework Full Name',
     version: '1.0',
     description: 'Brief description of the framework',
     category: 'security' // or 'privacy', 'governance', 'risk', etc.
   };

   const CONTROLS = [
     {
       control_id: 'FC-1',
       title: 'Control Title',
       description: 'Control description...',
       family: 'Control Family Name',
       priority: 'P1' // P1-P3 or null
     },
     // ... more controls
   ];

   async function seed() {
     const client = await pool.connect();
     try {
       await client.query('BEGIN');

       // Insert framework
       const { rows: [fw] } = await client.query(
         `INSERT INTO compliance_frameworks (code, name, version, description, category)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (code) DO UPDATE SET name = $2, version = $3, description = $4
          RETURNING id`,
         [FRAMEWORK.code, FRAMEWORK.name, FRAMEWORK.version, FRAMEWORK.description, FRAMEWORK.category]
       );

       // Insert controls
       for (const ctrl of CONTROLS) {
         await client.query(
           `INSERT INTO framework_controls (framework_id, control_id, title, description, family, priority)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (framework_id, control_id) DO UPDATE SET title = $3, description = $4`,
           [fw.id, ctrl.control_id, ctrl.title, ctrl.description, ctrl.family, ctrl.priority]
         );
       }

       await client.query('COMMIT');
       console.log(`Seeded ${CONTROLS.length} controls for ${FRAMEWORK.name}`);
     } catch (err) {
       await client.query('ROLLBACK');
       throw err;
     } finally {
       client.release();
     }
   }

   seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
   ```

4. **Add crosswalk mappings**
   - Map controls to existing frameworks using `nist_publication_control_mappings` table
   - Mapping strengths: `primary`, `supporting`, `informative`
   - Use UPSERT pattern: `ON CONFLICT ... DO UPDATE`

5. **Verify the framework**
   ```bash
   cd controlweave/backend
   node scripts/seed-<framework-name>.js
   npm run check:syntax
   ```
   - Confirm framework appears in GET `/api/v1/frameworks`
   - Verify control count matches the official catalog
   - Test crosswalk mappings are accurate

## Crosswalk Mapping Template

```javascript
const CROSSWALKS = [
  { source_control: 'NEW-1', target_framework: 'NIST_800_53', target_control: 'AC-1', strength: 'primary' },
  { source_control: 'NEW-2', target_framework: 'ISO_27001', target_control: 'A.5.1', strength: 'supporting' },
];
```

## Checklist

- [ ] Framework metadata is accurate (code, name, version)
- [ ] All controls from the official catalog are included
- [ ] Control families are properly organized
- [ ] Crosswalk mappings are sourced from official publications
- [ ] Seed script uses transactions (BEGIN/COMMIT/ROLLBACK)
- [ ] Seed script uses ON CONFLICT for idempotent re-runs
- [ ] Script filename uses kebab-case in `/scripts`
- [ ] `npm run check:syntax` passes
