import React, { useEffect, useState } from 'react';
import { Sparkles, HelpCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface GoogleAdProps {
  slot?: string;
  client?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'banner';
  className?: string;
}

export default function GoogleAd({
  slot = 'default-slot-12345',
  client = 'ca-pub-9426553826048560',
  format = 'auto',
  className = ''
}: GoogleAdProps) {
  const [adLoaded, setAdLoaded] = useState<boolean>(true);
  const [useRealGoogleAds, setUseRealGoogleAds] = useState<boolean>(false);
  const [activePromoIndex, setActivePromoIndex] = useState<number>(0);

  // Chess premium tips & promotion messages for fallbacks or simulated ads
  const chessPromos = [
    {
      title: 'أكاديمية المعلم الكبير للشطرنج ♟️',
      desc: 'احصل على كورسات احترافية مجانية لتتعلم افتتاحيات غامبت الوزير وكش مات نابليون على يد محترفين!',
      btnText: 'تصفح الأكاديمية الآن',
      bgColor: 'from-amber-950/40 to-slate-900',
      borderColor: 'border-amber-500/20'
    },
    {
      title: 'عضوية غرفة الشطرنج الذهبية 👑',
      desc: 'أزل الإعلانات نهائياً على الهاتف، وافتح أشكال قطع ذهبية وثلاثية الأبعاد خيالية ومحلل خطط فوري مقابل 0.99$ فقط!',
      btnText: 'الترقية للذهبية (0.99$)',
      bgColor: 'from-amber-600/10 to-transparent',
      borderColor: 'border-amber-500/30 text-amber-300'
    },
    {
      title: 'تحميل كـ كود تطبيقي للأندرويد 📱',
      desc: 'تطبيقنا يدعم التثبيت المباشر (PWA). افتحه فقط من متصفح كروم على هاتفك واضغط على زر التثبيت لمناسبة كاملة الشاشة بدون عوائق!',
      btnText: 'دليل تثبيت الهاتف',
      bgColor: 'from-blue-950/40 to-slate-900',
      borderColor: 'border-blue-500/20'
    }
  ];

  useEffect(() => {
    // If we're using real Google ads, try to push the ad to adsbygoogle array
    if (useRealGoogleAds) {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
      } catch (err) {
        console.warn('Google AdSense render deferred:', err);
        setAdLoaded(false);
      }
    }
  }, [useRealGoogleAds]);

  const rotatePromo = () => {
    setActivePromoIndex((prev) => (prev + 1) % chessPromos.length);
  };

  return (
    <div className={`relative bg-slate-900/95 border rounded-2xl p-4 overflow-hidden shadow-lg transition-all ${className} ${chessPromos[activePromoIndex].borderColor}`}>
      {/* Decorative gradient accents */}
      <div className={`absolute inset-0 bg-gradient-to-br ${chessPromos[activePromoIndex].bgColor} pointer-events-none opacity-40`} />

      {/* Ad Tag Badge Label header */}
      <div className="relative z-10 flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-1.5 bg-slate-950/65 px-2.5 py-1 rounded-full border border-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            {useRealGoogleAds ? 'مساحة إعلانية Google AdSense' : 'إعلان راعي ومقترحات الشطرنج'}
          </span>
        </div>

        {/* Development switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setUseRealGoogleAds(!useRealGoogleAds);
              setAdLoaded(true);
            }}
            className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 px-2 py-0.5 rounded transition-all"
            title="تبديل بين إعلان حقيقي ومحاكي"
          >
            {useRealGoogleAds ? 'تبديل للمقترحات 💡' : 'تهيئة Google Ads ⚙️'}
          </button>
          
          {!useRealGoogleAds && (
            <button
              onClick={rotatePromo}
              className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors"
              title="الإعلان التالي"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10">
        {useRealGoogleAds ? (
          <div className="min-h-[90px] w-full flex flex-col items-center justify-center">
            {/* Real Google AdSense responsive DOM Element */}
            <ins
              className="adsbygoogle"
              style={{ display: 'block', minWidth: '250px', minHeight: '90px' }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format={format}
              data-full-width-responsive="true"
            />
            
            {/* Real Ad message info if it is loading/waiting verification */}
            <div className="text-center mt-2.5 space-y-1">
              <span className="text-[10px] text-slate-500 block">
                ملاحظة: سيظهر إعلان Google AdSense الحقيقي بمجرد ربط نطاقك (Domain) في لوحة تحكم AdSense.
              </span>
              <div className="text-[9px] text-amber-500/80 bg-amber-500/5 py-1 px-3 rounded-md inline-block border border-amber-500/10">
                PUB-ID: {client} | SLOT: {slot}
              </div>
            </div>
          </div>
        ) : (
          /* Simulated custom high-conversion app sponsor banner which is gorgeous & matches theme colors */
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right">
            <div className="space-y-1 max-w-xl">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {chessPromos[activePromoIndex].title}
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                {chessPromos[activePromoIndex].desc}
              </p>
            </div>
            
            <button 
              onClick={() => {
                const isPwaPromo = chessPromos[activePromoIndex].title.includes('أندرويد');
                if (isPwaPromo) {
                  const promptBtn = document.getElementById('btn_pwa_prompt_main');
                  if (promptBtn) {
                    promptBtn.scrollIntoView({ behavior: 'smooth' });
                    promptBtn.classList.add('animate-bounce');
                    setTimeout(() => promptBtn.classList.remove('animate-bounce'), 3000);
                  } else {
                    alert('هذا التطبيق جاهز للأندرويد! اضغط على زر "تثبيت التطبيق على الهاتف" في الردهة لتبدأ فوراً.');
                  }
                } else {
                  alert(`شكراً للمشاركة والاهتمام بـ: ${chessPromos[activePromoIndex].title}! سيتم تفعيل البوابة قريباً عند الإطلاق.`);
                }
              }}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
            >
              <span>{chessPromos[activePromoIndex].btnText}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
