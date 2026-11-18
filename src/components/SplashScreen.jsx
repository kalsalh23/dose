import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('splashShown')) {
      navigate('/app', { replace: true });
      return;
    }
    sessionStorage.setItem('splashShown', 'true');
    const timer = setTimeout(() => {
      navigate('/app', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-screen" role="img" aria-label="Dose Coffee & More loading screen">
      <div className="splash-center">
        <div className="splash-logo-wrapper">
          <img
            src="/logo.jpg"
            alt="Dose Coffee & More"
            className="splash-logo"
            width="120"
            height="120"
            loading="eager"
          />
          <svg className="splash-ring" viewBox="0 0 140 140" aria-hidden="true">
            <defs>
              <linearGradient id="splash-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2F3E2E" />
                <stop offset="100%" stopColor="#5A6B58" />
              </linearGradient>
            </defs>
            <circle className="splash-ring-track" cx="70" cy="70" r="62" />
            <circle className="splash-ring-fill" cx="70" cy="70" r="62" />
          </svg>
        </div>
        <h1 className="splash-arabic">حب من طرف قهوة</h1>
        <p className="splash-english">Dose Coffee & More</p>
      </div>
    </div>
  );
}