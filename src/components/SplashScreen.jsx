import React from 'react';
import './SplashScreen.css';

const SplashScreen = () => {
  return (
    <div className="splash-screen">
      <img src="/logo.png" alt="Dose Coffee & More" className="splash-logo" />
      <h1 className="splash-arabic">حب من طرف قهوة</h1>
      <p className="splash-english">Dose Coffee &amp; More</p>
      <div className="splash-loading" />
    </div>
  );
};

export default SplashScreen;
