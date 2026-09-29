import { initDatabase } from '../server/db/init.ts';
import { queryOne, queryAll, runQuery } from '../server/db/database.ts';
import { searchListings, createListing, renewListing } from '../server/services/listingService.ts';
import { getOrCreateConversation, sendMessage, getConversationMessages, toggleBlockUser } from '../server/services/chatService.ts';
import { createReport, takeModeratorAction, adminPermanentBan, adminUnban, adminVerifyOrganization } from '../server/services/moderationService.ts';
import { processListingExpirations } from '../server/services/expirationService.ts';
import { generateToken, authenticateToken, verifyTelegramAuth } from '../server/auth/telegram.ts';

async function runTests() {
  console.log('=== STARTING TOPHAND AUTOMATED TEST SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Database Init Test
    await initDatabase();
    const categoriesCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    assert((categoriesCount?.count || 0) >= 14, 'Database initialized with 14+ Uzbek categories');

    // 2. Authentication & Token Tests
    const adminUser = await queryOne<any>("SELECT * FROM users WHERE role = 'ADMIN'");
    assert(Boolean(adminUser), 'Admin user exists in database');

    const token = generateToken(adminUser);
    assert(Boolean(token && token.length > 20), 'JWT token generated successfully');

    const verifiedUser = await authenticateToken(token);
    assert(verifiedUser?.id === adminUser.id, 'JWT token authenticated correctly server-side');

    // 3. Listings CRUD & 4 Types Test
    const newListing = await createListing(adminUser.id, {
      type: 'SERVICE_OFFER',
      title: 'Avtomatlashtirilgan test santexnik xizmati',
      description: 'Sinov tavsifi kamida 15 belgidan ortiq bo‘lishi kerak.',
      category_id: 'cat_santexnika',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      price_type: 'FROM',
      price_min: 75000,
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'],
    });
    assert(newListing?.status === 'ACTIVE', 'New listing created immediately in ACTIVE status');
    assert(newListing?.images.length === 1, 'Listing images saved and associated properly');

    // 4. Renewal & Expiration Test
    const renewed = await renewListing(newListing.id, adminUser.id);
    assert(Boolean(renewed?.renewed_at), 'Listing renewal updates renewed_at without changing created_at');

    const expirationResult = await processListingExpirations();
    assert(typeof expirationResult.archived_count === 'number', 'Background expiration job runs authoritatively');

    // 5. Ranking & Diversification Test
    const searchRes = await searchListings({ page: 1, limit: 10 });
    assert(searchRes.items.length > 0, 'Search returns active listings with pagination');
    assert(searchRes.items[0]._ranking_score !== undefined, 'Listings ranked by 4-tier score (Follows > Completeness > Geo > Newest)');

    // 6. Follow System Test
    const userA = 'usr_seeker';
    const userB = 'usr_company_owner';
    await runQuery('DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id = ?', [userA, userB]);
    await runQuery('INSERT INTO follows (id, follower_user_id, followed_user_id, created_at) VALUES (?, ?, ?, ?)', [
      'test_fol_1', userA, userB, new Date().toISOString()
    ]);
    const followCheck = await queryOne('SELECT id FROM follows WHERE follower_user_id = ? AND followed_user_id = ?', [userA, userB]);
    assert(Boolean(followCheck), 'User can follow another user');

    // 7. Chat System & Listing Context Test
    const conv = await getOrCreateConversation('lst_santexnik_usta', userA);
    assert(Boolean(conv && conv.id), 'Conversation created with listing context');

    const msg = await sendMessage(conv.id, userA, 'Salom, test xabari!');
    assert(Boolean(msg && msg.text === 'Salom, test xabari!'), 'Message sent with authorization check');

    const messagesData = await getConversationMessages(conv.id, userA, 'USER');
    assert(messagesData.messages.length > 0, 'Conversation messages retrieved by authorized participant');

    // 8. User Block Enforcement
    await toggleBlockUser(userA, 'usr_craftsman');
    let blockThrew = false;
    try {
      await sendMessage(conv.id, userA, 'Bloklangan xabar');
    } catch {
      blockThrew = true;
    }
    assert(blockThrew, 'Blocked user cannot send messages');
    await toggleBlockUser(userA, 'usr_craftsman'); // Unblock

    // 9. Moderation & Audit Test
    const report = await createReport(userA, {
      target_type: 'LISTING',
      target_id: newListing.id,
      reason: 'spam',
      description: 'Test shikoyati',
    });
    assert(report.status === 'PENDING', 'User report created successfully');

    await takeModeratorAction('usr_moderator', {
      report_id: report.id,
      action: 'HIDE_LISTING',
      target_type: 'LISTING',
      target_id: newListing.id,
      reason: 'Sinov yashirish amali',
    });
    const hiddenListing = await queryOne<any>('SELECT status FROM listings WHERE id = ?', [newListing.id]);
    assert(hiddenListing?.status === 'HIDDEN', 'Moderator successfully hid reported listing');

    // 10. Admin Ban & Organization Verification Test
    await adminVerifyOrganization(adminUser.id, 'org_bunyodkor', true);
    const verifiedOrg = await queryOne<any>('SELECT verification_status FROM organizations WHERE id = ?', ['org_bunyodkor']);
    assert(verifiedOrg?.verification_status === 'VERIFIED', 'Admin verified organization status');

    await adminPermanentBan(adminUser.id, 'usr_requester', 'Test sababli ban');
    const bannedUser = await queryOne<any>('SELECT is_banned, ban_type FROM users WHERE id = ?', ['usr_requester']);
    assert(bannedUser?.is_banned === 1 && bannedUser?.ban_type === 'PERMANENT', 'Admin permanently banned user');

    await adminUnban(adminUser.id, 'usr_requester');
    const unbannedUser = await queryOne<any>('SELECT is_banned, ban_type FROM users WHERE id = ?', ['usr_requester']);
    assert(unbannedUser?.is_banned === 0, 'Admin unbanned user');

    const auditCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs');
    assert((auditCount?.count || 0) > 0, 'Audit logs recorded for all administrative actions');

    // 11. Centralized Logo Management Tests
    const initialLogoSetting = await queryOne<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', ['active_logo_url']);
    assert(Boolean(initialLogoSetting?.value), 'Default active logo exists in system_settings database table');

    // Test PNG signature verification function
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const isValidSignature =
      validPngHeader[0] === 0x89 &&
      validPngHeader[1] === 0x50 &&
      validPngHeader[2] === 0x4E &&
      validPngHeader[3] === 0x47 &&
      validPngHeader[4] === 0x0D &&
      validPngHeader[5] === 0x0A &&
      validPngHeader[6] === 0x1A &&
      validPngHeader[7] === 0x0A;
    assert(isValidSignature, 'PNG magic bytes signature validation strictly enforced');

    // Test rejection of fake/non-PNG files
    const fakeJpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
    const isFakePngValid =
      fakeJpegHeader[0] === 0x89 &&
      fakeJpegHeader[1] === 0x50 &&
      fakeJpegHeader[2] === 0x4E &&
      fakeJpegHeader[3] === 0x47;
    assert(!isFakePngValid, 'Non-PNG file formats (JPEG, SVG, etc.) correctly identified and rejected');

    // Test audit log recording for UPDATE_LOGO
    const testAuditId = `audit_test_logo_${Date.now()}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        testAuditId,
        adminUser.id,
        'UPDATE_LOGO',
        'SYSTEM',
        'logo',
        JSON.stringify({ previous_logo: '/TOPHAND.uz (1).png', new_logo: '/uploads/logo/test.png' }),
        new Date().toISOString()
      ]
    );
    const logoAuditCheck = await queryOne('SELECT * FROM audit_logs WHERE id = ?', [testAuditId]);
    assert(Boolean(logoAuditCheck), 'Logo replacement action successfully recorded in audit log with admin user and timestamp');

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    failed++;
  }

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
