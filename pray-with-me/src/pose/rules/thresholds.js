// كل أرقام قواعد الوضعيات في مكان واحد.
// تنبيه: هذي أرقام مبدئية (تخمين أولي)، لازم نضبطها بالتجربة في صفحة المختبر:
//   npm run dev  ثم افتحي  /labs/pose.html
// الزوايا بالدرجات. "الميلان" = ميلان الجذع عن الأفق: 0 = أفقي تماماً، 90 = عمودي تماماً.

export const THRESHOLDS = {
  standing: {
    // القيام: الجذع (من الكتف إلى الورك) لازم يكون شبه عمودي
    minTorsoIncline: 20,
    // زاوية الركبة (ورك-ركبة-كاحل): 180 = رجل مستقيمة تماماً
    minKneeAngle: 60,
  },
  ruku: {
    // الركوع: الظهر لازم يكون قريب من الأفقي، يعني الميلان صغير
    maxTorsoIncline: 10,
    // الركبتين مستقيمتين تقريباً (نسمح بانحناء بسيط)
    minKneeAngle: 150,
  },
sujood: {
  headBelowHipMargin: 0.15,
  wristGroundMargin: 0.12,
  kneeGroundMargin: 0.12,
  elbowAboveWristMargin: 0.03,
},
};