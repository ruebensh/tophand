import React, { useState, useEffect } from 'react';
import { Review, RatingSummary } from '../../types/index.ts';
import { apiRequest } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatDateAgo } from '../../lib/utils.ts';
import {
  Star,
  MessageSquare,
  Edit3,
  Trash2,
  Reply,
  ShieldCheck,
  ShieldAlert,
  X,
  Send,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ReviewsSectionProps {
  targetUserId: string;
  employerName: string;
  listingId?: string;
  onRatingUpdated?: (newAvg: number, total: number) => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  targetUserId,
  employerName,
  listingId,
  onRatingUpdated,
}) => {
  const { user, openLoginModal } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary>({
    average_rating: 0,
    total_reviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [formComment, setFormComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete modal state
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Employer reply inline state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Load reviews from API
  const fetchReviews = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ reviews: Review[]; summary: RatingSummary }>(
        `/api/reviews/target/${targetUserId}`
      );
      setReviews(data.reviews || []);
      setSummary(
        data.summary || {
          average_rating: 0,
          total_reviews: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        }
      );
      if (onRatingUpdated && data.summary) {
        onRatingUpdated(data.summary.average_rating, data.summary.total_reviews);
      }
    } catch (err: any) {
      setError(err.message || 'Sharhlarni yuklashda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      fetchReviews();
    }
  }, [targetUserId]);

  const isOwner = user?.id === targetUserId;
  const isStaff = user?.role === 'MODERATOR' || user?.role === 'ADMIN';

  // Handle open review form modal
  const handleOpenAddReview = () => {
    if (!user) {
      openLoginModal(() => handleOpenAddReview());
      return;
    }
    if (isOwner) {
      alert('O‘zingizning profilingizga sharh qoldira olmaysiz');
      return;
    }
    setEditingReviewId(null);
    setFormRating(5);
    setHoverRating(0);
    setFormComment('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditReview = (review: Review) => {
    setEditingReviewId(review.id);
    setFormRating(review.rating);
    setHoverRating(0);
    setFormComment(review.comment);
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit review (Create or Edit)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formComment.trim().length < 3) {
      setFormError('Sharh matni kamida 3 ta belgidan iborat bo‘lishi kerak');
      return;
    }
    if (formComment.trim().length > 1000) {
      setFormError('Sharh matni 1000 ta belgidan oshmasligi kerak');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingReviewId) {
        // Edit existing
        await apiRequest<Review>(`/api/reviews/${editingReviewId}`, {
          method: 'PUT',
          body: JSON.stringify({
            rating: formRating,
            comment: formComment.trim(),
          }),
        });
      } else {
        // Create new
        await apiRequest<Review>('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            target_user_id: targetUserId,
            listing_id: listingId || null,
            rating: formRating,
            comment: formComment.trim(),
          }),
        });
      }

      setIsModalOpen(false);
      await fetchReviews();
    } catch (err: any) {
      setFormError(err.message || 'Sharhni saqlashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete review
  const handleDeleteReview = async () => {
    if (!deletingReviewId) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/reviews/${deletingReviewId}`, {
        method: 'DELETE',
      });
      setDeletingReviewId(null);
      await fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Sharhni o‘chirishda xatolik yuz berdi');
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit employer reply
  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      await apiRequest(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          reply: replyText.trim(),
        }),
      });
      setReplyingReviewId(null);
      setReplyText('');
      await fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Javob yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Delete employer reply
  const handleDeleteReply = async (reviewId: string) => {
    if (!confirm('Javobingizni o‘chirmoqchimisiz?')) return;
    try {
      await apiRequest(`/api/reviews/${reviewId}/reply`, {
        method: 'DELETE',
      });
      await fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Javobni o‘chirishda xatolik yuz berdi');
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return 'Juda yomon';
      case 2:
        return 'Qoniqarsiz';
      case 3:
        return 'O‘rtacha';
      case 4:
        return 'Yaxshi';
      case 5:
        return 'A’lo darajada';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EBECF0] p-6 sm:p-8 shadow-xs">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EBECF0]">
        <div>
          <h3 className="text-xl font-extrabold text-[#172B4D] tracking-tight">
            Foydalanuvchilar sharhlari
          </h3>
          <p className="text-xs sm:text-sm text-[#5E6C84] mt-1">
            Ushbu ish beruvchi yoki mutaxassis bilan ishlash bo‘yicha haqiqiy fikrlar
          </p>
        </div>

        {!isOwner && (
          <button
            onClick={handleOpenAddReview}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1673E6] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Star className="w-4 h-4 fill-white" />
            <span>Sharh qoldirish</span>
          </button>
        )}
      </div>

      {/* 2. Rating Summary Section */}
      <div className="py-6 border-b border-[#EBECF0]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Overall score & stars */}
          <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left justify-center">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black text-[#172B4D] tracking-tight">
                {summary.total_reviews > 0 ? summary.average_rating.toFixed(1) : '0.0'}
              </span>
              <span className="text-sm text-[#5E6C84] font-medium">/ 5.0</span>
            </div>

            {/* Five visual stars */}
            <div className="flex items-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= Math.round(summary.average_rating);
                return (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      isFilled ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-gray-200 fill-gray-100'
                    }`}
                  />
                );
              })}
            </div>

            <p className="text-xs font-medium text-[#5E6C84]">
              {summary.total_reviews > 0
                ? `${summary.total_reviews} ta haqiqiy sharh asosida`
                : 'Hali baholanmagan'}
            </p>
          </div>

          {/* Right: Star distribution bars */}
          <div className="md:col-span-7 flex flex-col gap-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
              const percent =
                summary.total_reviews > 0 ? Math.round((count / summary.total_reviews) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <div className="w-14 flex items-center gap-1 font-semibold text-[#172B4D] shrink-0">
                    <span>{stars}</span>
                    <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                  </div>

                  <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <span className="w-12 text-right text-[11px] font-medium text-[#5E6C84] shrink-0">
                    {count} ta
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Review List Section */}
      <div className="pt-6">
        {isLoading ? (
          /* Loading Skeletons */
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-5 border border-[#EBECF0] rounded-2xl animate-pulse space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-32 h-4 bg-gray-200 rounded" />
                    <div className="w-20 h-3 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-10 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-600 bg-rose-50 rounded-2xl border border-rose-100">
            {error}
          </div>
        ) : reviews.length === 0 ? (
          /* Empty State */
          <div className="p-10 text-center bg-[#F9FAFB] rounded-2xl border border-[#EBECF0]">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1673E6] flex items-center justify-center text-xl mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-[#172B4D]">Hali sharhlar mavjud emas</h4>
            <p className="text-xs text-[#5E6C84] mt-1 max-w-sm mx-auto">
              Ushbu ish beruvchi haqida birinchi bo‘lib sharh qoldiring va boshqalarga yordam bering.
            </p>
            {!isOwner && (
              <button
                onClick={handleOpenAddReview}
                className="mt-4 px-4 py-2 rounded-xl bg-[#1673E6] hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Birinchi sharhni yozish
              </button>
            )}
          </div>
        ) : (
          /* Review Cards List */
          <div className="space-y-4">
            {reviews.map((rev) => {
              const isAuthor = user?.id === rev.author_user_id;
              const canDelete = isAuthor || isStaff;
              const isReplying = replyingReviewId === rev.id;

              return (
                <div
                  key={rev.id}
                  className="bg-white border border-[#EBECF0] rounded-2xl p-5 hover:border-gray-300 transition-colors"
                >
                  {/* Top Bar: Author & Rating */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          rev.author_photo_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            rev.author_name || 'User'
                          )}&background=1673E6&color=fff`
                        }
                        alt={rev.author_name}
                        className="w-10 h-10 rounded-full object-cover border border-[#EBECF0]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#172B4D]">
                            {rev.author_name}
                          </span>
                          {rev.author_username && (
                            <span className="text-[11px] text-[#5E6C84]">
                              @{rev.author_username}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#5E6C84]">
                          {formatDateAgo(rev.created_at)}
                          {rev.updated_at !== rev.created_at && ' (tahrirlangan)'}
                        </span>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                      <span className="text-xs font-bold text-amber-700">{rev.rating}</span>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-gray-200 fill-gray-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="mt-3.5 text-xs sm:text-sm text-[#172B4D] leading-relaxed whitespace-pre-wrap font-normal">
                    {rev.comment}
                  </div>

                  {/* Review Author / Moderator Actions */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {isAuthor && (
                        <button
                          onClick={() => handleOpenEditReview(rev)}
                          className="text-[#1673E6] hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Tahrirlash</span>
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => setDeletingReviewId(rev.id)}
                          className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isStaff && !isAuthor ? 'O‘chirish (Moderatsiya)' : 'O‘chirish'}</span>
                        </button>
                      )}
                    </div>

                    {/* Employer Reply Action Trigger */}
                    {isOwner && !rev.employer_reply && (
                      <button
                        onClick={() => {
                          setReplyingReviewId(isReplying ? null : rev.id);
                          setReplyText('');
                        }}
                        className="text-[#1673E6] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>{isReplying ? 'Bekor qilish' : 'Javob berish'}</span>
                      </button>
                    )}
                  </div>

                  {/* Employer Reply Display */}
                  {rev.employer_reply && (
                    <div className="mt-3.5 p-4 rounded-xl bg-blue-50/50 border-l-4 border-[#1673E6] text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-[#1673E6]">
                          <Building2 className="w-4 h-4" />
                          <span>Ish beruvchi javobi</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({rev.employer_name})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#5E6C84]">
                            {rev.employer_reply_at ? formatDateAgo(rev.employer_reply_at) : ''}
                          </span>
                          {(isOwner || isStaff) && (
                            <button
                              onClick={() => handleDeleteReply(rev.id)}
                              className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                              title="Javobni o'chirish"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[#172B4D] leading-relaxed whitespace-pre-wrap">
                        {rev.employer_reply}
                      </p>
                    </div>
                  )}

                  {/* Inline Employer Reply Form */}
                  {isReplying && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-[#EBECF0] space-y-2">
                      <label className="block text-[11px] font-bold text-[#172B4D]">
                        Sharhga rasmiy javobingiz:
                      </label>
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Mijoz yoki nomzodga muloyim va professional javob yozing..."
                        className="w-full p-2.5 text-xs bg-white border border-[#EBECF0] rounded-lg focus:outline-hidden focus:border-[#1673E6]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingReviewId(null)}
                          className="px-3 py-1.5 rounded-lg border border-[#EBECF0] text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingReply || !replyText.trim()}
                          onClick={() => handleSubmitReply(rev.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#1673E6] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSubmittingReply ? 'Yuborilmoqda...' : 'Javobni yuborish'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Modal: Add or Edit Review */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-[#EBECF0] shadow-2xl max-w-lg w-full p-6 sm:p-7 relative animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EBECF0]">
              <div>
                <h3 className="font-extrabold text-lg text-[#172B4D]">
                  {editingReviewId ? 'Sharhni tahrirlash' : 'Sharh qoldirish'}
                </h3>
                <p className="text-xs text-[#5E6C84] mt-0.5">
                  Ish beruvchi: <span className="font-semibold text-[#172B4D]">{employerName}</span>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
              {/* Interactive 5-Star Selection */}
              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1.5">
                  Bahoni tanlang (1 dan 5 gacha)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoverRating || formRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setFormRating(star)}
                          className="p-1 focus:outline-hidden focus:ring-2 focus:ring-[#1673E6] rounded-md transition-transform hover:scale-115 active:scale-95 cursor-pointer"
                          aria-label={`${star} yulduz`}
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              isActive
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-gray-300 fill-gray-100'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-bold text-[#1673E6] ml-2">
                    {getRatingLabel(hoverRating || formRating)}
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#172B4D]">Sharhingiz</label>
                  <span
                    className={`text-[11px] font-mono ${
                      formComment.length > 900 ? 'text-amber-600 font-bold' : 'text-[#5E6C84]'
                    }`}
                  >
                    {formComment.length} / 1000
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Ushbu ish beruvchi haqidagi fikringizni yozing..."
                  className="w-full p-3.5 text-xs sm:text-sm bg-white border border-[#EBECF0] rounded-xl focus:outline-hidden focus:border-[#1673E6] focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-[#EBECF0] text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1673E6] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Yuborilmoqda...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{editingReviewId ? 'O‘zgarishlarni saqlash' : 'Sharhni yuborish'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Delete Confirmation */}
      {deletingReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-[#EBECF0] shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-[#172B4D]">Sharhni o‘chirmoqchimisiz?</h4>
              <p className="text-xs text-[#5E6C84] mt-1">
                Ushbu amalni ortga qaytarib bo‘lmaydi. Sharh butunlay o‘chiriladi va reyting qayta
                hisoblanadi.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeletingReviewId(null)}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl border border-[#EBECF0] text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteReview}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors"
              >
                {isDeleting ? 'O‘chirilmoqda...' : 'O‘chirish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
