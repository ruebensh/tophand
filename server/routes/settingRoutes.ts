import { Router } from 'express';
import { queryOne } from '../db/database.ts';

const router = Router();

// Public endpoint to retrieve active logo and version timestamp
router.get('/logo', async (_req, res) => {
  try {
    const setting = await queryOne<{ value: string; updated_at: string }>(
      'SELECT value, updated_at FROM system_settings WHERE key = ?',
      ['active_logo_url']
    );

    const logoUrl = setting?.value || '/TOPHAND.uz (1).png';
    const updatedAt = setting?.updated_at || new Date().toISOString();
    const version = new Date(updatedAt).getTime().toString();

    res.json({
      logo_url: logoUrl,
      updated_at: updatedAt,
      version,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public endpoint to retrieve active branding configuration
router.get('/branding', async (_req, res) => {
  try {
    const [brandSetting, logoSetting, favLight, favDark] = await Promise.all([
      queryOne<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM system_settings WHERE key = ?',
        ['platform_brand']
      ),
      queryOne<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM system_settings WHERE key = ?',
        ['active_logo_url']
      ),
      queryOne<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = ?',
        ['favicon_light_url']
      ),
      queryOne<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = ?',
        ['favicon_dark_url']
      ),
    ]);

    let brand = {
      prefix_text: 'top',
      prefix_color: '#111827',
      suffix_text: 'hand',
      suffix_color: '#1673E6',
      domain_suffix: '.uz',
      domain_color: '#1673E6',
      tagline: 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
      logo_url: logoSetting?.value || '/TOPHAND.uz (1).png',
      favicon_light_url: favLight?.value || '/favicon-light.png',
      favicon_dark_url: favDark?.value || '/favicon-dark.png',
    };

    if (brandSetting?.value) {
      try {
        brand = { ...brand, ...JSON.parse(brandSetting.value) };
      } catch (e) {
        // fallback
      }
    }

    if (logoSetting?.value) {
      brand.logo_url = logoSetting.value;
    }
    // Favicon always comes from its own dedicated settings (independent of the site logo).
    brand.favicon_light_url = favLight?.value || '/favicon-light.png';
    brand.favicon_dark_url = favDark?.value || '/favicon-dark.png';

    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
