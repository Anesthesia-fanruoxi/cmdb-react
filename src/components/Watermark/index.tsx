/**
 * 页面水印组件
 */

import { useAuthStore } from '@/stores/authStore';
import './style.css';

interface Props {
  text?: string;
}

const Watermark = ({ text }: Props) => {
  const user = useAuthStore(s => s.user);
  const userName = useAuthStore(s => s.userName);
  const nick = user?.nick_name || '';
  const account = userName || user?.user_name || '';
  const displayText = text || (nick && account ? `${nick} (${account})` : nick || account || 'CMDB Desktop');

  return (
    <div className="watermark-overlay" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="watermark-pattern" x="0" y="0" width="260" height="200" patternUnits="userSpaceOnUse">
            <text
              x="130"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(-30, 130, 100)"
              fill="currentColor"
              fillOpacity="0.08"
              fontSize="16"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              fontWeight="500"
            >
              {displayText}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
      </svg>
    </div>
  );
};

export default Watermark;
