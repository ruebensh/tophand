import React from 'react';
import { Bell, BellRing, Loader2, CheckCircle2, Info } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

/**
 * Lets the user turn browser (Web) Push on/off. Once enabled, TopHand
 * notifications arrive even when the tab or the whole site is closed.
 */
export const PushNotificationsCard: React.FC = () => {
  const { pushSupported, pushPermission, pushEnabled, isEnablingPush, enablePush, disablePush } =
    useNotifications();
  const { t } = useI18n();
  const [error, setError] = React.useState<string | null>(null);

  const handleToggle = async () => {
    setError(null);
    try {
      if (pushEnabled) {
        await disablePush();
      } else {
        await enablePush();
      }
    } catch (err: any) {
      setError(err?.message || t('profile.pushErr'));
    }
  };

  if (!pushSupported) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
        <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-extrabold text-gray-900">{t('profile.pushTitle')}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('profile.pushUnsupported')}
          </p>
        </div>
      </div>
    );
  }

  const denied = pushPermission === 'denied' && !pushEnabled;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              pushEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {pushEnabled ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-900">
              {t('profile.pushHeading')}
              {pushEnabled && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('profile.pushOn')}
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {t('profile.pushBody')}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isEnablingPush}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
            pushEnabled
              ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isEnablingPush ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('profile.pushWaiting')}
            </span>
          ) : pushEnabled ? (
            t('profile.pushTurnOff')
          ) : (
            t('profile.pushTurnOn')
          )}
        </button>
      </div>

      {denied && (
        <p className="text-[11px] text-amber-600 mt-3">
          {t('profile.pushDenied')}
        </p>
      )}
      {error && <p className="text-[11px] text-red-600 mt-3">{error}</p>}
    </div>
  );
};

export default PushNotificationsCard;
