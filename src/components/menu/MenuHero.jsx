import { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import Chip from "@mui/material/Chip";
import { getCustomerMenuItems } from "../../utils/menuAvailability";
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import supabase from "../../supabase";
import MenuItemImage from "./MenuItemImage";

export default function MenuHero() {
  const { items = [], loadItemImage, setSearchQuery, handleAlignment } = useMenu();
  const { language } = useLanguage();
  const { slug, storeInfo } = useTenant();
  const { branchSlug } = useBranch();
  const [topSellerId, setTopSellerId] = useState(null);
  const availableItems = getCustomerMenuItems(items);
  const bestSeller = availableItems.find((item) => item.id === topSellerId);
  const featured = bestSeller || availableItems[0];
  const isBestSeller = Boolean(bestSeller);
  const isEnglish = language === "en";
  const currency = storeInfo?.currency || (isEnglish ? "SAR" : "ر.س");

  useEffect(() => {
    let active = true;
    setTopSellerId(null);
    if (!slug) return () => { active = false; };

    supabase.rpc("get_public_menu_top_seller", {
      p_slug: slug,
      p_branch_slug: branchSlug,
    }).then(({ data, error }) => {
      if (error) throw error;
      if (active) setTopSellerId(data || null);
    }).catch((error) => {
      if (active) {
        console.warn("تعذّر تحميل الصنف الأعلى طلبًا:", error?.message || error);
      }
    });

    return () => { active = false; };
  }, [slug, branchSlug]);

  if (!featured) return null;

  return (
    <section className="customer-menu-hero" aria-label={isBestSeller ? (isEnglish ? "Most ordered menu item" : "الصنف الأكثر طلبًا") : (isEnglish ? "Featured menu item" : "طبق مميز من المنيو")}>
      <div className="customer-menu-hero-copy">
        <Chip
          className="customer-menu-hero-badge"
          icon={<LocalFireDepartmentRoundedIcon />}
          label={isBestSeller
            ? (isEnglish ? "Most ordered" : "الأكثر طلبًا")
            : (isEnglish ? "A menu favorite" : "اختيار من قائمتنا")}
          size="small"
        />
        <Typography className="customer-menu-hero-title" component="h2">{featured.name}</Typography>
        {featured.description && (
          <Typography className="customer-menu-hero-description" component="p">{featured.description}</Typography>
        )}
        <Typography className="customer-menu-hero-price" component="p">
          {Number(featured.price || 0).toLocaleString(isEnglish ? "en-SA" : "ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {" "}{currency}
        </Typography>
        <Button
          className="customer-menu-hero-action"
          endIcon={<ArrowDownwardRoundedIcon />}
          onClick={() => {
            setSearchQuery("");
            handleAlignment(null, "all");
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                const target = document.getElementById(`customer-menu-item-${featured.id}`)
                  || document.getElementById("customer-menu-items");
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            });
          }}
        >
          {isEnglish ? "Explore the menu" : "تصفّح القائمة"}
        </Button>
      </div>
      <div className="customer-menu-hero-photo">
        <MenuItemImage
          src={featured.image}
          alt={featured.name}
          imageLoading={featured.imageLoading}
          imageError={featured.imageError}
          loadImage={() => loadItemImage(featured.id)}
          priority
          width="100%"
          height="100%"
          borderRadius={0}
        />
      </div>
    </section>
  );
}
