import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RoomServiceOutlinedIcon from "@mui/icons-material/RoomServiceOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { getRecentCustomerOrders } from "../../utils/customerTracking";
import { buildCustomerMenuTrackingTarget } from "../../utils/customerMenuNavigation.js";

export default function CustomerMenuBottomNav({ onOpenCart, onCallWaiter, onOpenReview }) {
  const { cartItems, tableNumber } = useCart();
  const { language } = useLanguage();
  const { slug } = useTenant();
  const { branchSlug } = useBranch();
  const navigate = useNavigate();
  const isEnglish = language === "en";
  const itemCount = cartItems.reduce((count, item) => count + Number(item.quantity || 0), 0);
  const latestOrder = getRecentCustomerOrders(slug, branchSlug, Date.now(), tableNumber)[0] || null;

  const openTracking = () => {
    const target = buildCustomerMenuTrackingTarget(slug, latestOrder);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };

  return (
    <nav className="customer-menu-bottom-nav" aria-label={isEnglish ? "Menu navigation" : "التنقل في المنيو"}>
      <button className="customer-menu-nav-button customer-menu-nav-cart" type="button" onClick={onOpenCart} aria-label={`${isEnglish ? "Cart" : "السلة"}: ${itemCount}`}>
        <span className="customer-menu-nav-icon-wrap"><ShoppingBagOutlinedIcon fontSize="small" /><span className="customer-menu-cart-count" aria-hidden="true">{itemCount}</span></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Cart" : "السلة"}</span>
      </button>
      <button className="customer-menu-nav-button customer-menu-chat-placeholder" type="button" disabled aria-label={isEnglish ? "Chat, coming soon" : "المحادثة، قريبًا"} title={isEnglish ? "Coming soon" : "قريبًا"}>
        <span className="customer-menu-nav-icon-wrap"><ChatBubbleOutlineRoundedIcon fontSize="small" /></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Chat" : "المحادثة"}<small>{isEnglish ? "Soon" : "قريبًا"}</small></span>
      </button>
      <button className="customer-menu-nav-button" type="button" onClick={() => navigate("/")} aria-label={isEnglish ? "Home" : "الرئيسية"}>
        <span className="customer-menu-nav-icon-wrap"><HomeOutlinedIcon fontSize="small" /></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Home" : "الرئيسية"}</span>
      </button>
      <button className="customer-menu-nav-button" type="button" onClick={openTracking} aria-label={isEnglish ? "Track order" : "تتبع الطلب"}>
        <span className="customer-menu-nav-icon-wrap"><ReceiptLongOutlinedIcon fontSize="small" /></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Track" : "التتبع"}</span>
      </button>
      <button className="customer-menu-nav-button" type="button" onClick={onCallWaiter} aria-label={isEnglish ? "Call staff" : "طلب مساعدة الموظف"}>
        <span className="customer-menu-nav-icon-wrap"><RoomServiceOutlinedIcon fontSize="small" /></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Staff" : "الموظف"}</span>
      </button>
      <button className="customer-menu-nav-button" type="button" onClick={onOpenReview} aria-label={isEnglish ? "Leave a review" : "شاركنا رأيك"}>
        <span className="customer-menu-nav-icon-wrap"><RateReviewOutlinedIcon fontSize="small" /></span>
        <span className="customer-menu-nav-label">{isEnglish ? "Review" : "التقييم"}</span>
      </button>
    </nav>
  );
}
