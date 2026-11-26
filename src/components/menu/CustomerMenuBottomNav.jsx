import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RoomServiceOutlinedIcon from "@mui/icons-material/RoomServiceOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { getRecentCustomerOrders } from "../../utils/customerTracking";
import {
  buildCustomerMenuPath,
  buildCustomerMenuTrackingTarget,
  buildCustomerPagePath,
  getCustomerReviewUrl,
  preserveCustomerContext,
} from "../../utils/customerMenuNavigation.js";

export default function CustomerMenuBottomNav({ activePage = "menu", canCallWaiter = false, tableNumber: pageTableNumber }) {
  const { cartItems, tableNumber: cartTableNumber } = useCart();
  const { language } = useLanguage();
  const { slug, storeInfo, tableNumber: routeTableNumber } = useTenant();
  const { branchSlug } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const isEnglish = language === "en";
  const tableNumber = pageTableNumber ?? routeTableNumber ?? cartTableNumber;
  const itemCount = cartItems.reduce((count, item) => count + Number(item.quantity || 0), 0);
  const latestOrder = getRecentCustomerOrders(slug, branchSlug, Date.now(), tableNumber)[0] || null;
  const orderReference = latestOrder?.orderId ? String(latestOrder.orderId).slice(-6).toUpperCase() : "";
  const reviewUrl = getCustomerReviewUrl(storeInfo?.google_maps_review_url);
  const canRequestService = canCallWaiter && Boolean(tableNumber) && !/^(cashier|كاشير)$/i.test(String(tableNumber).trim());
  const menuPath = buildCustomerMenuPath(slug, tableNumber, location.search);
  const cartPath = buildCustomerPagePath("cart", slug, tableNumber, location.search);
  const servicePath = buildCustomerPagePath("service", slug, tableNumber, location.search);
  const navItems = [
    { key: "menu", label: isEnglish ? "Menu" : "المنيو", icon: <RestaurantMenuOutlinedIcon fontSize="small" />, path: menuPath },
    { key: "cart", label: isEnglish ? "Cart" : "السلة", icon: <ShoppingBagOutlinedIcon fontSize="small" />, path: cartPath, count: itemCount },
    { key: "track", label: isEnglish ? "Track" : "التتبع", icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
    ...(canRequestService ? [{ key: "service", label: isEnglish ? "Service" : "المساعدة", icon: <RoomServiceOutlinedIcon fontSize="small" />, path: servicePath }] : []),
    ...(reviewUrl ? [{
      key: "review",
      label: isEnglish ? "Review" : "التقييم",
      icon: <RateReviewOutlinedIcon fontSize="small" />,
      path: buildCustomerPagePath("review", slug, tableNumber, location.search),
    }] : []),
  ];

  const openTracking = () => {
    const target = buildCustomerMenuTrackingTarget(slug, latestOrder);
    navigate(preserveCustomerContext(target.path, location.search), target.state ? { state: target.state } : undefined);
  };

  const handleItemClick = (item) => {
    if (item.key === "track") {
      openTracking();
    } else if (item.key !== activePage) {
      navigate(item.path);
    }
  };

  return (
    <nav
      className="customer-menu-bottom-nav"
      aria-label={isEnglish ? "Customer navigation" : "تنقل العميل"}
      style={{ "--customer-nav-count": navItems.length }}
    >
      {navItems.map((item) => (
        <button
          key={item.key}
          className="customer-menu-nav-button"
          type="button"
          onClick={() => handleItemClick(item)}
          aria-current={activePage === item.key ? "page" : undefined}
          aria-label={item.key === "cart"
            ? `${item.label}: ${item.count}`
            : item.key === "track" && orderReference
              ? `${isEnglish ? "Track order" : "تتبع الطلب"} #${orderReference}`
              : item.label}
        >
          <span className="customer-menu-nav-icon-wrap">
            {item.icon}
            {item.key === "cart" && <span className="customer-menu-cart-count" aria-hidden="true">{item.count}</span>}
          </span>
          <span className="customer-menu-nav-label">
            {item.label}
            {item.key === "track" && orderReference && <small>#{orderReference}</small>}
          </span>
        </button>
      ))}
    </nav>
  );
}
