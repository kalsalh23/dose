import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-screen" role="img" aria-label="Dose Coffee & More loading screen">
      <img
        src="/logo.png"
        alt="Dose Coffee & More"
        className="splash-logo"
        width="120"
        height="120"
        loading="eager"
      />
      <h1 className="splash-arabic">حب من طرف قهوة</h1>
      <p className="splash-english">Dose Coffee & More</p>
      <div className="splash-loading" aria-hidden="true">
        <span className="splash-loading-fill" />
      </div>
    </div>
  );
}