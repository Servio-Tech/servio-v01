import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { textOnColor } from "./qrUtils";

const QRArtwork = forwardRef(function QRArtwork({ item, brand, message, logo, accent, ink, frame, language }, ref) {
  const ar = language === "ar";
  return (
    <div ref={ref} className={`qr-artwork qr-frame-${frame}`} dir={ar ? "rtl" : "ltr"} style={{ "--qr-accent": accent, "--qr-on-accent": textOnColor(accent) }}>
      <div className="qr-artwork-topline" />
      <div className="qr-artwork-inner">
        <div className="qr-artwork-brand">
          {logo && <img src={logo} alt="" className="qr-artwork-logo" />}
          <div className="qr-artwork-brand-name">{brand}</div>
        </div>
        <div className="qr-artwork-rule" />
        <div className="qr-artwork-label">{item.kind === "cashier" ? (ar ? "الكاشير" : "CASHIER") : (ar ? `الطاولة ${item.number}` : `TABLE ${item.number}`)}</div>
        <div className="qr-artwork-code">
          <QRCodeSVG value={item.url} size={210} bgColor="#ffffff" fgColor={ink} level="H" marginSize={4} />
        </div>
        <div className="qr-artwork-message">{message}</div>
        <div className="qr-artwork-footnote">{ar ? "وجبتك تبدأ هنا" : "YOUR TABLE, YOUR MENU"}</div>
      </div>
      <div className="qr-artwork-bottomline" />
    </div>
  );
});

export default QRArtwork;
