import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { VerifiedBadge } from '../common/VerifiedBadge.tsx';
import { X, UserCheck, UserPlus, Users, MapPin } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';

export interface FollowUserItem {
  id: string;
  name: string;
  telegram_username?: string;
  profile_photo_url?: string;
  bio?: string;
  role: string;
  region_name?: string;
  district_name?: string;
  is_profile_complete?: boolean;
  is_verified?: boolean;
  is_followed_by_viewer?: boolean;
  followed_at?: string;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  initialTab?: 'followers' | 'following';
  onOpenProfile: (id: string) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  initialTab = 'followers',
  onOpenProfile,
}) => {
  const { user: currentUser, openLoginModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<FollowUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const data = await apiRequest<FollowUserItem[]>(`/api/users/${userId}/${activeTab}`);
        if (isMounted) {
          setUsers(data || []);
          const map: Record<string, boolean> = {};
          (data || []).forEach((u) => {
            map[u.id] = Boolean(u.is_followed_by_viewer);
          });
          setFollowingMap(map);
        }
      } catch (err) {
        console.error('Failed to load follow list:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, activeTab]);

  const handleToggleFollow = async (e: React.MouseEvent, targetUser: FollowUserItem) => {
    e.stopPropagation();

    if (!currentUser) {
      openLoginModal();
      return;
    }

    if (currentUser.id === targetUser.id) return;

    setLoadingActionId(targetUser.id);
    const currentlyFollowing = Boolean(followingMap[targetUser.id]);
    const nextState = !currentlyFollowing;

    // Optimistic update
    setFollowingMap((prev) => ({ ...prev, [targetUser.id]: nextState }));

    try {
      const res = await apiRequest<{ followed: boolean }>(`/api/users/${targetUser.id}/follow`, {
        method: 'POST',
      });
      setFollowingMap((prev) => ({ ...prev, [targetUser.id]: res.followed }));
    } catch (err: any) {
      // Rollback on error
      setFollowingMap((prev) => ({ ...prev, [targetUser.id]: currentlyFollowing }));
      alert(err.message || 'Obunani o‘zgartirishda xatolik yuz berdi');
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      padded={false}
      header={
        <>
          {/* Header */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-base text-gray-950 truncate">{userName}</h3>
                <p className="text-[11px] text-gray-400">Obuna aloqalari</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Yopish"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setActiveTab('followers')}
              className={`py-3 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === 'followers'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              Obunachilar ({activeTab === 'followers' ? users.length : '...'})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`py-3 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === 'following'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              Obunalar ({activeTab === 'following' ? users.length : '...'})
            </button>
          </div>
        </>
      }
    >
      <div className="p-3 sm:p-4 divide-y divide-gray-100">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse p-2">
                  <div className="w-11 h-11 bg-gray-200 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-28 h-3.5 bg-gray-200 rounded-md" />
                    <div className="w-20 h-2.5 bg-gray-100 rounded-md" />
                  </div>
                  <div className="w-20 h-7 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <span className="text-3xl block mb-2">👥</span>
              <p className="font-bold text-sm text-gray-800">
                {activeTab === 'followers'
                  ? 'Hozircha obunachilar yo‘q'
                  : 'Hozircha hech kimga obuna bo‘linmagan'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                {activeTab === 'followers'
                  ? 'Ushbu profilga boshqa foydalanuvchilar obuna bo‘lganda shu yerda ko‘rinadi.'
                  : 'Ushbu foydalanuvchi qiziqarli usta va mutaxassislarni kuzatganda shu yerda jamlanadi.'}
              </p>
            </div>
          ) : (
            users.map((item) => {
              const isCurrentUser = currentUser?.id === item.id;
              const isItemFollowed = Boolean(followingMap[item.id]);
              const isItemLoading = loadingActionId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onOpenProfile(item.id);
                  }}
                  className="flex items-center justify-between gap-3 py-3 px-2 hover:bg-gray-50/80 rounded-2xl transition-colors cursor-pointer group"
                >
                  {/* Avatar & User Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={
                        item.profile_photo_url ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${item.name}`
                      }
                      alt={item.name}
                      className="w-11 h-11 rounded-2xl object-cover ring-2 ring-gray-100 shrink-0 group-hover:ring-blue-200 transition-all"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {item.name}
                        </span>
                        {item.is_verified && <VerifiedBadge size="xs" />}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 truncate">
                        <span className="text-blue-600 font-medium">{item.role}</span>
                        {(item.district_name || item.region_name) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">
                                {item.district_name || item.region_name}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Follow / Unfollow Action Button */}
                  {!isCurrentUser && (
                    <button
                      type="button"
                      disabled={isItemLoading}
                      onClick={(e) => handleToggleFollow(e, item)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs ${
                        isItemFollowed
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isItemLoading ? (
                        <span className="animate-spin text-xs">⏳</span>
                      ) : isItemFollowed ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Obunadasiz</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Obuna</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
      </div>
    </Modal>
  );
};
