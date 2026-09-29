import { Router } from 'express';
import { pool, queryAll } from '../db/database.ts';
import { UZBEKISTAN_DISTRICTS } from '../db/districtsData.ts';

const router = Router();

router.get('/regions', async (_req, res) => {
  try {
    const regions = await queryAll('SELECT * FROM regions ORDER BY sort_order ASC');
    res.json(regions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/districts', async (req, res) => {
  try {
    const regionId = req.query.region_id as string;
    let sql = 'SELECT * FROM districts';
    const params: any[] = [];
    if (regionId) {
      sql += ' WHERE region_id = $1';
      params.push(regionId);
    }
    sql += ' ORDER BY sort_order ASC';
    const districts = await queryAll(sql, params);
    res.json(districts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Detect nearest district from GPS coordinates
// Returns: { region_id, region_name, district_id, district_name, lat, lon }
router.get('/detect', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // Find nearest district using Haversine approximation
    let nearest: (typeof UZBEKISTAN_DISTRICTS)[0] | null = null;
    let minDist = Infinity;

    for (const d of UZBEKISTAN_DISTRICTS) {
      const dlat = d.lat - lat;
      const dlon = d.lon - lon;
      const dist = dlat * dlat + dlon * dlon;
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }

    if (!nearest) {
      return res.status(404).json({ error: 'No districts found' });
    }

    // Fetch region name from DB
    const regionRow = await pool.query(
      'SELECT name_uz FROM regions WHERE id = $1',
      [nearest.region_id]
    );
    const region_name = regionRow.rows[0]?.name_uz || nearest.region_id;

    res.json({
      region_id: nearest.region_id,
      region_name,
      district_id: nearest.id,
      district_name: nearest.name_uz,
      lat: nearest.lat,
      lon: nearest.lon,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get nearby listings from GPS coordinates
router.get('/nearby-listings', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radiusKm = parseFloat((req.query.radius as string) || '30');

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon required' });
    }

    // Find districts within radius
    const R = 6371; // Earth radius km
    const nearbyDistrictIds: string[] = [];

    for (const d of UZBEKISTAN_DISTRICTS) {
      const dLat = ((d.lat - lat) * Math.PI) / 180;
      const dLon = ((d.lon - lon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((d.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      if (dist <= radiusKm) {
        nearbyDistrictIds.push(d.id);
      }
    }

    if (nearbyDistrictIds.length === 0) {
      return res.json({ items: [] });
    }

    const placeholders = nearbyDistrictIds.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      SELECT l.id, l.title, l.type, l.price_type, l.price_min, l.price_max, l.currency,
             l.district_id, d.name_uz AS district_name, d.latitude, d.longitude,
             l.region_id, r.name_uz AS region_name,
             l.category_id, c.name_uz AS category_name,
             l.created_at, l.status
      FROM listings l
      LEFT JOIN districts d ON l.district_id = d.id
      LEFT JOIN regions r ON l.region_id = r.id
      LEFT JOIN categories c ON l.category_id = c.id
      WHERE l.district_id IN (${placeholders})
        AND l.status = 'ACTIVE'
      ORDER BY l.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(sql, nearbyDistrictIds);
    res.json({ items: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
