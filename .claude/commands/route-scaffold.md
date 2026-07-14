# Scaffold API Route

Create a new API route module following all ControlWeaver conventions.

## Input

$ARGUMENTS — Route description (e.g., "incident response management at /api/v1/incidents, Pro tier")

## Steps

1. **Create the route file**
   - Location: `controlweave/backend/src/routes/<routeName>.js`
   - Use camelCase for the filename (e.g., `incidentResponse.js`)
   - Add tier comment at the top: `// @tier: community|pro|enterprise`

2. **Apply the route template**

   ```javascript
   // @tier: <tier>
   const express = require('express');
   const router = express.Router();
   const pool = require('../config/database');
   const { authenticate, requirePermission } = require('../middleware/auth');
   const { createRateLimiter } = require('../middleware/rateLimit');

   // Apply authentication to all routes in this module
   router.use(authenticate);

   // ControlWeaver has no tier gating — do not add requireTier()/requireProEdition()
   // to new routes. Use requirePermission() for access control instead.

   // Rate limiter: adjust based on expected usage
   const rateLimiter = createRateLimiter({
     label: '<routeName>',
     windowMs: 15 * 60 * 1000,
     max: 100,
     keyGenerator: (req) => `org:${req.user?.organization_id || req.ip}`
   });
   router.use(rateLimiter);

   // GET list — paginated, org-scoped
   router.get('/', async (req, res) => {
     try {
       const page = Math.max(1, parseInt(req.query.page, 10) || 1);
       const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
       const offset = (page - 1) * limit;

       const result = await pool.query(
         `SELECT * FROM <table>
          WHERE organization_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
         [req.user.organization_id, limit, offset]
       );

       const countResult = await pool.query(
         'SELECT COUNT(*) FROM <table> WHERE organization_id = $1',
         [req.user.organization_id]
       );

       res.json({
         success: true,
         data: result.rows,
         pagination: {
           page,
           limit,
           total: parseInt(countResult.rows[0].count, 10)
         }
       });
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   });

   // GET by ID — org-scoped
   router.get('/:id', async (req, res) => {
     try {
       const result = await pool.query(
         'SELECT * FROM <table> WHERE id = $1 AND organization_id = $2',
         [req.params.id, req.user.organization_id]
       );
       if (result.rows.length === 0) {
         return res.status(404).json({ error: 'Resource not found' });
       }
       res.json({ success: true, data: result.rows[0] });
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   });

   // POST create — with permission check
   router.post('/', requirePermission('<resource>.write'), async (req, res) => {
     try {
       // Validate inputs
       const { name } = req.body || {};
       if (!name || typeof name !== 'string' || name.trim().length === 0) {
         return res.status(400).json({ error: 'Name is required' });
       }

       const result = await pool.query(
         `INSERT INTO <table> (organization_id, name, created_by)
          VALUES ($1, $2, $3)
          RETURNING *`,
         [req.user.organization_id, name.trim(), req.user.id]
       );

       res.status(201).json({ success: true, data: result.rows[0] });
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   });

   // PUT update — org-scoped with permission
   router.put('/:id', requirePermission('<resource>.write'), async (req, res) => {
     try {
       const { name } = req.body || {};
       const result = await pool.query(
         `UPDATE <table> SET name = COALESCE($1, name), updated_at = NOW()
          WHERE id = $2 AND organization_id = $3
          RETURNING *`,
         [name?.trim() || null, req.params.id, req.user.organization_id]
       );
       if (result.rows.length === 0) {
         return res.status(404).json({ error: 'Resource not found' });
       }
       res.json({ success: true, data: result.rows[0] });
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   });

   // DELETE — org-scoped with permission
   router.delete('/:id', requirePermission('<resource>.write'), async (req, res) => {
     try {
       const result = await pool.query(
         'DELETE FROM <table> WHERE id = $1 AND organization_id = $2 RETURNING id',
         [req.params.id, req.user.organization_id]
       );
       if (result.rows.length === 0) {
         return res.status(404).json({ error: 'Resource not found' });
       }
       res.json({ success: true, message: 'Deleted successfully' });
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   });

   module.exports = router;
   ```

3. **Register the route in server.js**
   - Add import: `const <routeName>Routes = safeRequire('./routes/<routeName>');`
   - Add registration: `if (<routeName>Routes) app.use('/api/v1/<url-path>', <routeName>Routes);`
   - Use direct `require` instead of `safeRequire` only for routes whose module is always present (no optional dependency)

4. **Create database migration** (if new table needed)
   - Use the `/db-migration` command to create the migration
   - Include `organization_id`, `created_at`, `updated_at`, `created_by` columns

5. **Validate**
   ```bash
   cd controlweave/backend && npm run check:syntax
   cd controlweave/frontend && npm run typecheck
   ```

## Post-Scaffold Checklist

- [ ] Route file uses camelCase filename
- [ ] `// @tier:` comment at top of file
- [ ] `authenticate` middleware applied to all routes
- [ ] `requireTier()` applied if Pro or Enterprise
- [ ] `organization_id` filtering on every query
- [ ] Parameterized SQL only (no string concatenation)
- [ ] Input validation before processing
- [ ] Proper error handling (no leaked details)
- [ ] Rate limiting configured
- [ ] Route registered in `server.js`
- [ ] TEVV-API CI check will pass (route file + registration + auth middleware)
- [ ] Corresponding frontend API client created (TEVV-API-11 check)
