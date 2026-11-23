import { Box, Button, Typography } from "@mui/material";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";
import MenuItemImage from "./MenuItemImage";

export default function MenuHero() {
  const { customerMenu = [], loadItemImage } = useMenu();
  const { language } = useLanguage();
  const featured = customerMenu[0];
  const isEnglish = language === "en";

  if (!featured) return null;

  return (
    <section className="customer-menu-hero" aria-label={isEnglish ? "Featured menu item" : "طبق مميز من المنيو"}>
      <div className="customer-menu-hero-copy">
        <Typography className="customer-menu-hero-eyebrow" component="p">
          {isEnglish ? "A SERVIO MENU PICK" : "اختيار من قائمتنا"}
        </Typography>
        <Typography className="customer-menu-hero-title" component="h2">{featured.name}</Typography>
        {featured.description && (
          <Typography className="customer-menu-hero-description" component="p">{featured.description}</Typography>
        )}
        <Button
          className="customer-menu-hero-action"
          endIcon={<ArrowDownwardRoundedIcon />}
          onClick={() => document.getElementById("customer-menu-items")?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
