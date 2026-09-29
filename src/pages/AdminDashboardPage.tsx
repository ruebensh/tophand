import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api.ts';
import {
  Users,
  Building2,
  Layers,
  FileText,
  BarChart3,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Ban,
  ArrowLeft,
  Palette,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileCheck,
  CheckCircle2,
  TrendingUp,
  Filter,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Wrench,
  Briefcase,
} from 'lucide-react';
import { formatDateAgo } from '../lib/utils.ts';
import { PlatformManagementSection } from '../components/admin/PlatformManagementSection.tsx';
import { UserPassportModal } from '../components/admin/UserPassportModal.tsx';
import { CategoryEditModal } from '../components/admin/CategoryEditModal.tsx';
import { OrganizationEditModal } from '../components/admin/OrganizationEditModal.tsx';
import { Category } from '../types/index.ts';

interface AdminDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'platform' | 'users' | 'organizations' | 'categories' | 'audit'
  >('overview');

  // Stats
  const [overview, setOverview] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Users tab
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userVerificationFilter, setUserVerificationFilter] = useState('');
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // User Passport Modal
  const [passportModalUser, setPassportModalUser] = useState<any>(null);
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false);

  // Orgs tab & modal
  const [orgsList, setOrgsList] = useState<any[]>([]);
  const [isOrgsLoading, setIsOrgsLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);

  // Categories tab & modal
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryCatalogFilter, setCategoryCatalogFilter] = useState<'all' | 'services' | 'jobs'>('all');
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [modalDefaultParentId, setModalDefaultParentId] = useState<string | null>(null);
  const [modalDefaultCatalogId, setModalDefaultCatalogId] = useState<string>('services');

  // Audit tab
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Action Dialog (Ban)
  const [selectedUserForBan, setSelectedUserForBan] = useState<any>(null);
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  const fetchOverviewAndAnalytics = async () => {
    setIsStatsLoading(true);
    try {
      const [overviewData, analyticsData] = await Promise.all([
        apiRequest('/api/admin/overview'),
        apiRequest('/api/admin/analytics').catch(() => null),
      ]);
      setOverview(overviewData);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching admin overview/analytics:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (userSearch) params.append('search', userSearch);
      if (userRoleFilter) params.append('role', userRoleFilter);
      const data = await apiRequest(`/api/admin/users?${params.toString()}`);
      let list = data;
      if (userVerificationFilter) {
        list = list.filter((u: any) => (u.verification_status || 'UNVERIFIED') === userVerificationFilter);
      }
      setUsersList(list);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchOrgs = async () => {
    setIsOrgsLoading(true);
    try {
      const data = await apiRequest('/api/admin/organizations');
      setOrgsList(data);
    } catch (err) {
      console.error('Error fetching organizations:', err);
    } finally {
      setIsOrgsLoading(false);
    }
  };

  const fetchCategories = async () => {
    setIsCategoriesLoading(true);
    try {
      const data = await apiRequest('/api/categories/tree');
      setCategoriesList(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsAuditLoading(true);
    try {
      const data = await apiRequest('/api/admin/audit-logs');
      setAuditLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewAndAnalytics();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverviewAndAnalytics();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'organizations') fetchOrgs();
    if (activeTab === 'categories') fetchCategories();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  const handlePermanentBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForBan || !banReason.trim()) return;

    setIsBanning(true);
    try {
      await apiRequest(`/api/admin/users/${selectedUserForBan.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      alert('Foydalanuvchi butunlay bloklandi');
      setSelectedUserForBan(null);
      setBanReason('');
      fetchUsers();
      fetchOverviewAndAnalytics();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/unban`, { method: 'POST' });
      alert('Foydalanuvchi blokdan chiqarildi');
      fetchUsers();
      fetchOverviewAndAnalytics();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'MODERATOR' ? 'USER' : 'MODERATOR';
    if (!confirm(`Foydalanuvchi rolini "${newRole}" ga o'zgartirmoqchimisiz?`)) return;

    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      alert('Rol muvaffaqiyatli yangilandi');
      fetchUsers();
      fetchOverviewAndAnalytics();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    }
  };

  const handleVerifyOrg = async (orgId: string, currentStatus: string) => {
    const nextVerify = currentStatus !== 'VERIFIED';
    try {
      await apiRequest(`/api/admin/organizations/${orgId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verify: nextVerify }),
      });
      alert(nextVerify ? 'Tashkilot tasdiqlandi (VERIFIED)' : 'Tasdiq bekor qilindi');
      fetchOrgs();
      fetchOverviewAndAnalytics();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Haqiqatan ham "${orgName}" tashkilotini o‘chirmoqchimisiz?`)) return;
    try {
      await apiRequest(`/api/admin/organizations/${orgId}`, { method: 'DELETE' });
      alert('Tashkilot muvaffaqiyatli o‘chirildi');
      fetchOrgs();
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik yuz berdi');
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string, isSub?: boolean) => {
    const label = isSub ? 'subkategoriyasini' : 'kategoriyasini va uning barcha subkategoriyalarini';
    if (!confirm(`Haqiqatan ham "${catName}" ${label} o‘chirmoqchimisiz?`)) return;
    try {
      await apiRequest(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik yuz berdi');
    }
  };

  const openPassportModal = (user: any) => {
    setPassportModalUser(user);
    setIsPassportModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer"
            title="Asosiy sahifaga qaytish"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-950">TopHand Bosh Admin Paneli</h1>
            </div>
            <p className="text-xs text-gray-500">
              Kengaytirilgan statistika, platforma brendi, pasport verifikatsiyasi va to‘liq boshqaruv
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/moderator')}
          className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>Moderator paneliga o‘tish</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Umumiy hisobot va statistika', icon: BarChart3 },
          { id: 'platform', label: 'Platforma boshqaruvi', icon: Palette },
          { id: 'users', label: 'Foydalanuvchilar va pasportlar', icon: Users },
          { id: 'organizations', label: 'Tashkilotlar', icon: Building2 },
          { id: 'categories', label: 'Kategoriyalar', icon: Layers },
          { id: 'audit', label: 'Audit jurnali', icon: FileText },
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Overview Tab & Advanced Analytics */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          {overview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Jami foydalanuvchilar</span>
                <p className="text-2xl font-black text-gray-900 mt-1">{overview.total_users}</p>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {overview.moderators_count} mod / {overview.banned_users} bloklangan
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                <span className="text-[11px] font-bold text-blue-600 uppercase">Faol e’lonlar</span>
                <p className="text-2xl font-black text-blue-900 mt-1">{overview.active_listings}</p>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {overview.archived_listings} ta arxivda (30 kunlik)
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                <span className="text-[11px] font-bold text-amber-600 uppercase">Kutilayotgan shikoyatlar</span>
                <p className="text-2xl font-black text-amber-900 mt-1">{overview.pending_reports}</p>
                <span className="text-[10px] text-amber-700 mt-0.5 block">Moderator nazorati talab</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                <span className="text-[11px] font-bold text-emerald-600 uppercase">Tasdiqlangan korxonalar</span>
                <p className="text-2xl font-black text-emerald-900 mt-1">
                  {overview.verified_organizations} / {overview.total_organizations}
                </p>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">Ishonchli ish beruvchilar</span>
              </div>
            </div>
          )}

          {/* Kengaytirilgan Statistika (Advanced Analytics Section) */}
          {analytics && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-base text-gray-900">
                    Kengaytirilgan qidiruv va filtrlar statistikasi
                  </h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  Jami tahlil qilingan amallar: <strong>{analytics.total_tracked_events || 0} ta</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Eng ko'p qidirilgan / filtrlangan kategoriyalar */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        Eng ko‘p ishlatilgan kategoriyalar
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Foydalanuvchilar qidiruv va filtrlarda eng ko‘p tanlagan sohalar
                      </p>
                    </div>
                    <Layers className="w-4 h-4 text-blue-600" />
                  </div>

                  <div className="space-y-3">
                    {analytics.top_categories?.slice(0, 6).map((cat: any, idx: number) => {
                      const maxCount = analytics.top_categories[0]?.usage_count || 1;
                      const pct = Math.max(12, Math.round((cat.usage_count / maxCount) * 100));
                      return (
                        <div key={cat.category_id || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                              <span className="text-gray-400 font-mono text-[10px]">#{idx + 1}</span>
                              <span>{cat.category_name}</span>
                            </span>
                            <span className="font-bold text-blue-600 font-mono text-[11px]">
                              {cat.usage_count} marta
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Filtrning eng ko'p ishlatilgan qismlari */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        Filtr parametrlari tahlili
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Qaysi filtrlar orqali foydalanuvchilar takliflarni saralagan
                      </p>
                    </div>
                    <Filter className="w-4 h-4 text-purple-600" />
                  </div>

                  <div className="space-y-3">
                    {analytics.top_filters?.map((flt: any, idx: number) => {
                      const maxFlt = analytics.top_filters[0]?.usage_count || 1;
                      const pct = Math.max(10, Math.round((flt.usage_count / maxFlt) * 100));
                      return (
                        <div key={flt.filter_type || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                              <span className="text-gray-400 font-mono text-[10px]">#{idx + 1}</span>
                              <span>{flt.filter_name}</span>
                            </span>
                            <span className="font-bold text-purple-600 font-mono text-[11px]">
                              {flt.usage_count} marta
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-purple-50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-600 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Eng ko'p qidirilgan kalit so'zlar va Verifikatsiya ko'rsatkichlari */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Search keywords tag cloud */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        Eng ommabop qidiruv so‘rovlari
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Auditoriya tomonidan eng ko‘p yozilgan kasb va kalit so‘zlar
                      </p>
                    </div>
                    <Search className="w-4 h-4 text-emerald-600" />
                  </div>

                  {analytics.top_keywords && analytics.top_keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analytics.top_keywords.map((kw: any, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 text-xs font-semibold text-gray-800 transition-colors"
                        >
                          <span>{kw.keyword}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[10px] text-blue-600 font-mono font-bold">
                            {kw.search_count}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Hozircha qidiruv so‘rovlari to‘planmoqda...</p>
                  )}
                </div>

                {/* Verifikatsiya va Ishonchlilik Taxtasi */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        Foydalanuvchilar ishonchliligi (Trust & Identity)
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Pasport ma’lumotlari va tasdiq nishoni (Verified badge) holati
                      </p>
                    </div>
                    <FileCheck className="w-4 h-4 text-blue-600" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Tasdiqlangan shaxslar</span>
                      <p className="text-xl font-black text-emerald-900 mt-0.5">
                        {analytics.verification_stats?.verified_users || 0}
                      </p>
                      <span className="text-[10px] text-emerald-600">Pasporti tasdiqlangan</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100">
                      <span className="text-[10px] font-bold text-amber-700 uppercase block">Kutilayotgan arizalar</span>
                      <p className="text-xl font-black text-amber-900 mt-0.5">
                        {analytics.verification_stats?.pending_verifications || 0}
                      </p>
                      <span className="text-[10px] text-amber-600">Admin tekshirishi kerak</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUserVerificationFilter('PENDING');
                      setActiveTab('users');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Pasport arizalarini ko‘rish va tekshirish →</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Platform Management Tab (Platform Brand & Logo Customization) */}
      {activeTab === 'platform' && <PlatformManagementSection />}

      {/* 3. Users & Identity Verification Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                placeholder="Ism, username, telefon yoki Telegram ID..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-hidden focus:border-blue-600"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={userVerificationFilter}
                onChange={(e) => setUserVerificationFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden"
              >
                <option value="">Barcha verifikatsiya holati</option>
                <option value="VERIFIED">Faqat tasdiqlanganlar (VERIFIED)</option>
                <option value="PENDING">Kutilayotgan arizalar (PENDING)</option>
                <option value="UNVERIFIED">Tasdiqlanmaganlar (UNVERIFIED)</option>
                <option value="REJECTED">Rad etilganlar (REJECTED)</option>
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden"
              >
                <option value="">Barcha rollar</option>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <button
                onClick={fetchUsers}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Qidirish
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Foydalanuvchi</th>
                  <th className="p-3.5">Telegram</th>
                  <th className="p-3.5">Hudud</th>
                  <th className="p-3.5">Rol</th>
                  <th className="p-3.5">Pasport & Tasdiq</th>
                  <th className="p-3.5">E’lonlar</th>
                  <th className="p-3.5">Holat</th>
                  <th className="p-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-gray-400">
                      Foydalanuvchilar ro‘yxati yuklanmoqda...
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-gray-400">
                      Foydalanuvchilar topilmadi.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => {
                    const isVerified = u.verification_status === 'VERIFIED';
                    const isPending = u.verification_status === 'PENDING';
                    const hasPassport = Boolean(u.passport_number || u.pinfl);

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => openPassportModal(u)}
                      >
                        <td className="p-3.5 font-bold text-gray-900 flex items-center gap-2.5">
                          <img
                            src={u.profile_photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="group-hover:text-blue-600 transition-colors">{u.name}</span>
                              {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                            </div>
                            <span className="text-[10px] text-gray-400 font-normal">ID: {u.id}</span>
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-[11px]">
                          {u.telegram_username ? `@${u.telegram_username}` : `ID: ${u.telegram_id}`}
                        </td>

                        <td className="p-3.5 text-gray-500">
                          {u.district_name || 'Aniqlanmagan'}, {u.region_name || ''}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'MODERATOR'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>TASDIQLANGAN</span>
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">
                              <span>ARIZA KUTILMOQDA</span>
                            </span>
                          ) : hasPassport ? (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium">
                              Pasport kiritilgan
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">Kiritilmagan</span>
                          )}
                        </td>

                        <td className="p-3.5 font-bold">{u.listings_count || 0}</td>

                        <td className="p-3.5">
                          {u.is_banned ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {u.ban_type} BAN
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[10px]">Faol</span>
                          )}
                        </td>

                        <td
                          className="p-3.5 text-right space-x-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openPassportModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Pasport ma’lumotlari va IIV protokoli"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Pasport / IIV</span>
                          </button>

                          {u.role !== 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-[11px] font-medium cursor-pointer"
                            >
                              {u.role === 'MODERATOR' ? 'Mod-dan olish' : 'Mod qilish'}
                            </button>
                          )}

                          {u.is_banned ? (
                            <button
                              type="button"
                              onClick={() => handleUnban(u.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Blokdan olish
                            </button>
                          ) : (
                            u.role !== 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => setSelectedUserForBan(u)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold cursor-pointer"
                              >
                                Bloklash
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Organizations Tab */}
      {activeTab === 'organizations' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Tashkilotlar va Ish beruvchilar</h3>
              <p className="text-[11px] text-gray-500">
                Admin barcha tashkilotlarni to‘liq boshqarishi, qo‘shishi, tahrirlashi va tasdiqlashi mumkin.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedOrg(null);
                setIsOrgModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi tashkilot qo‘shish</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Tashkilot</th>
                  <th className="p-3.5">Egasi / Mas’ul</th>
                  <th className="p-3.5">Aloqa</th>
                  <th className="p-3.5">Holati</th>
                  <th className="p-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isOrgsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-gray-400">
                      Tashkilotlar yuklanmoqda...
                    </td>
                  </tr>
                ) : orgsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-gray-400">
                      Tashkilotlar mavjud emas.
                    </td>
                  </tr>
                ) : (
                  orgsList.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-gray-900 flex items-center gap-3">
                        {o.logo_url ? (
                          <img
                            src={o.logo_url}
                            alt={o.name}
                            className="w-9 h-9 rounded-xl object-cover border border-gray-100"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                            <Building2 className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <span className="block text-gray-950 font-extrabold">{o.name}</span>
                          <span className="text-[11px] text-gray-500 font-normal line-clamp-1 max-w-xs">
                            {o.description || o.address || 'Tavsif kiritilmagan'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-gray-900">{o.owner_name}</span>
                        {o.owner_username && (
                          <span className="block text-[10px] text-gray-400 font-mono">@{o.owner_username}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-gray-500 font-medium">
                        <div>{o.phone || 'Tel: kiritilmagan'}</div>
                        {o.website && (
                          <a
                            href={o.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-[11px] flex items-center gap-1 mt-0.5"
                          >
                            <span>Saytga o‘tish</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>

                      <td className="p-3.5">
                        {o.verification_status === 'VERIFIED' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            VERIFIED (Rasmiy)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                            UNVERIFIED
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleVerifyOrg(o.id, o.verification_status)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                            o.verification_status === 'VERIFIED'
                              ? 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          }`}
                        >
                          {o.verification_status === 'VERIFIED' ? 'Bekor qilish' : 'Tasdiqlash'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrg(o);
                            setIsOrgModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-[11px] font-medium cursor-pointer"
                        >
                          Tahrirlash
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteOrg(o.id, o.name)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer"
                        >
                          O‘chirish
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Hierarchical Categories & Subcategories Tab */}
      {activeTab === 'categories' && (() => {
        const filtered = categoriesList.filter((parent: any) => {
          if (categoryCatalogFilter !== 'all' && (parent.catalog_id || 'services') !== categoryCatalogFilter) {
            return false;
          }
          if (categorySearch.trim()) {
            const q = categorySearch.toLowerCase().trim();
            const matchParent = parent.name_uz?.toLowerCase().includes(q) || parent.slug?.toLowerCase().includes(q);
            const matchSub = parent.subs?.some((s: any) => s.name_uz?.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q));
            return matchParent || matchSub;
          }
          return true;
        });

        const totalSubs = categoriesList.reduce((acc: number, p: any) => acc + (p.subs?.length || 0), 0);

        return (
          <div className="space-y-4">
            {/* Header & Controls Card */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    Katalog va Kategoriyalar Ierarxiyasi
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Jami {categoriesList.length} ta asosiy kategoriya va {totalSubs} ta subkategoriya
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setModalDefaultParentId(null);
                      setModalDefaultCatalogId(categoryCatalogFilter === 'jobs' ? 'jobs' : 'services');
                      setIsCategoryModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Yangi asosiy kategoriya</span>
                  </button>
                </div>
              </div>

              {/* Filter by Catalog & Search bar */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-gray-50 rounded-2xl border border-gray-100 w-fit">
                  <button
                    type="button"
                    onClick={() => setCategoryCatalogFilter('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      categoryCatalogFilter === 'all'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Barchasi ({categoriesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryCatalogFilter('services')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      categoryCatalogFilter === 'services'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Xizmatlar ({categoriesList.filter((c: any) => (c.catalog_id || 'services') === 'services').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryCatalogFilter('jobs')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      categoryCatalogFilter === 'jobs'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Ish va Vakansiyalar ({categoriesList.filter((c: any) => c.catalog_id === 'jobs').length})</span>
                  </button>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Kategoriya yoki subkategoriya qidirish..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Hierarchical Categories Accordion List */}
            <div className="space-y-3">
              {isCategoriesLoading ? (
                <div className="bg-white rounded-3xl p-12 text-center text-xs text-gray-400 border border-gray-100">
                  Kategoriyalar va subkategoriyalar yuklanmoqda...
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center text-xs text-gray-400 border border-gray-100">
                  Hech qanday kategoriya topilmadi
                </div>
              ) : (
                filtered.map((parent: any) => {
                  const subs = parent.subs || [];
                  const isExpanded = expandedCategories[parent.id] !== false; // default expanded
                  const isJobs = parent.catalog_id === 'jobs';

                  return (
                    <div
                      key={parent.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden transition-all hover:border-gray-200"
                    >
                      {/* Parent Category Row */}
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-50/70 to-white">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCategories((prev) => ({
                                ...prev,
                                [parent.id]: !isExpanded,
                              }))
                            }
                            className="p-1.5 rounded-lg hover:bg-gray-200/60 text-gray-500 cursor-pointer transition-colors"
                            title={isExpanded ? 'Subkategoriyalarni yopish' : 'Subkategoriyalarni ochish'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-700" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-700" />
                            )}
                          </button>

                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {parent.icon && parent.icon.length <= 2 ? parent.icon : '📁'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-gray-900">{parent.name_uz}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isJobs
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {isJobs ? 'Ish / Vakansiya' : 'Xizmatlar'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  parent.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {parent.is_active ? 'Faol' : 'Nofaol'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                              <span className="font-mono">slug: {parent.slug}</span>
                              <span>•</span>
                              <span>{subs.length} ta subkategoriya</span>
                              <span>•</span>
                              <span>{parent.active_count || 0} ta faol e’lon</span>
                            </div>
                          </div>
                        </div>

                        {/* Parent Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(null);
                              setModalDefaultParentId(parent.id);
                              setModalDefaultCatalogId(parent.catalog_id || 'services');
                              setIsCategoryModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Ushbu kategoriya ichiga yangi subkategoriya qo'shish"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Subkategoriya</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(parent);
                              setModalDefaultParentId(null);
                              setIsCategoryModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-medium cursor-pointer transition-colors"
                          >
                            Tahrirlash
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(parent.id, parent.name_uz, false)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer transition-colors"
                          >
                            O‘chirish
                          </button>
                        </div>
                      </div>

                      {/* Subcategories Accordion Content */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/40 p-3 sm:p-4">
                          {subs.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                              Ushbu kategoriyada hali subkategoriyalar mavjud emas. Yuqoridagi "+ Subkategoriya" tugmasi orqali qo‘shishingiz mumkin.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {subs.map((sub: any) => (
                                <div
                                  key={sub.id}
                                  className="bg-white p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-2xs transition-all flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <GitBranch className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="font-bold text-xs text-gray-900 truncate">{sub.name_uz}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                      <span className="font-mono truncate">{sub.slug}</span>
                                      <span>•</span>
                                      <span className={sub.is_active ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                                        {sub.is_active ? 'Faol' : 'Nofaol'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCategory(sub);
                                        setModalDefaultParentId(parent.id);
                                        setIsCategoryModalOpen(true);
                                      }}
                                      className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                      title="Subkategoriyani tahrirlash"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCategory(sub.id, sub.name_uz, true)}
                                      className="p-1 rounded-md text-rose-500 hover:bg-rose-50 cursor-pointer"
                                      title="Subkategoriyani o‘chirish"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* 6. Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-sm text-gray-900">Barcha ma’muriy amallar auditi (Append-only)</h3>
            <p className="text-xs text-gray-400">
              Har bir xodim va moderator tomonidan amalga oshirilgan o‘zgarishlar avtomatik xronologik jurnalda saqlanadi
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Amal</th>
                  <th className="p-3.5">Ijrochi</th>
                  <th className="p-3.5">Obyekt</th>
                  <th className="p-3.5">Meta / Sabab</th>
                  <th className="p-3.5">Vaqt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {isAuditLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-gray-400">
                      Audit jurnali yuklanmoqda...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-gray-400">
                      Audit yozuvlari mavjud emas.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70">
                      <td className="p-3.5 font-bold text-blue-900">{log.action}</td>
                      <td className="p-3.5">
                        <span className="font-sans font-semibold text-gray-900">{log.actor_name}</span>{' '}
                        <span className="text-[10px] text-gray-400">({log.actor_role})</span>
                      </td>
                      <td className="p-3.5 text-gray-600">
                        {log.target_type}: {log.target_id}
                      </td>
                      <td className="p-3.5 text-gray-500 max-w-xs truncate">{log.metadata}</td>
                      <td className="p-3.5 text-gray-400 font-sans">{formatDateAgo(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Passport & IIV Protocol Modal */}
      <UserPassportModal
        isOpen={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        user={passportModalUser}
        onUserUpdated={() => {
          fetchUsers();
          fetchOverviewAndAnalytics();
        }}
      />

      {/* Organization Create / Edit Modal */}
      <OrganizationEditModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        org={selectedOrg}
        onSaved={fetchOrgs}
      />

      {/* Category Create / Edit Modal */}
      <CategoryEditModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setSelectedCategory(null);
          setModalDefaultParentId(null);
        }}
        category={selectedCategory}
        defaultParentId={modalDefaultParentId}
        defaultCatalogId={modalDefaultCatalogId}
        parentCategories={categoriesList}
        onSaved={fetchCategories}
      />

      {/* Permanent Ban Dialog */}
      {selectedUserForBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <Ban className="w-6 h-6" />
              <h3 className="font-bold text-base text-gray-900">Foydalanuvchini bloklash</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              <strong>{selectedUserForBan.name}</strong> (
              @{selectedUserForBan.telegram_username || selectedUserForBan.telegram_id}) hisobini butunlay bloklamoqchimisiz?
            </p>

            <form onSubmit={handlePermanentBan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Bloklash sababi (Audit jurnali uchun) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Qoidabuzarlik tafsilotini kiriting..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForBan(null)}
                  className="flex-1 py-2.5 rounded-full border border-gray-200 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isBanning}
                  className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  {isBanning ? 'Bloklanmoqda...' : 'Doimiy bloklash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
