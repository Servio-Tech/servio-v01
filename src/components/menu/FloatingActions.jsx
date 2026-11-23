import { useState } from "react";

// MUI COMPONENTS
import Box from "@mui/material/Box";
import Backdrop from "@mui/material/Backdrop";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import SpeedDialAction from "@mui/material/SpeedDialAction";

// MUI ICONS
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import RateReviewIcon from "@mui/icons-material/RateReview";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import { useLanguage } from "../../context/LanguageContext";

function FloatingActions({ handleReview, handleCallWaiter }) {
  const [openDial, setOpenDial] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const handleDialOpen = () => setOpenDial(true);
  const handleDialClose = () => setOpenDial(false);

  const actions = [
    {
      icon: <NotificationsActiveIcon sx={{ color: "#a54700" }} />,
      name: isEnglish ? "Call staff" : "طلب مساعدة الموظف",
      onClick: () => {
        handleDialClose();
        handleCallWaiter();
      },
    },
    {
      icon: <RateReviewIcon sx={{ color: "#a54700" }} />,
      name: isEnglish ? "Leave a review" : "شاركنا رأيك",
      onClick: () => {
        handleDialClose();
        handleReview();
      },
    },
  ];

  return (
    <>
      {/* 1. تظليل الشاشة عند فتح الـ SpeedDial */}
      <Backdrop
        open={openDial}
        onClick={handleDialClose}
        sx={{ zIndex: 1040, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      />

      {/* 2. حاوية الزر العائم بموقع ديناميكي وانتقال انسيابي */}
      <Box
        sx={{
          position: "fixed",
          bottom: "calc(150px + env(safe-area-inset-bottom, 0px))",
          right: 16,
          zIndex: 1050,
          transition: "opacity 0.2s ease",
        }}
      >
        <SpeedDial
          ariaLabel={isEnglish ? "Service options" : "خيارات الخدمة"}
          sx={{
            "& .MuiFab-primary": {
              backgroundColor: openDial ? "#f47920" : "rgba(244, 121, 32, 0.96)",
              backdropFilter: "blur(8px)",
              color: "#171a2f",
              boxShadow: openDial
                ? "0 8px 25px rgba(244, 121, 32, 0.35)"
                : "0 4px 15px rgba(0,0,0,0.15)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              transition: "all 0.3s ease",
              "&:hover": {
                backgroundColor: "#d96816",
                boxShadow: "0 6px 20px rgba(244, 121, 32, 0.38)",
              },
            },
          }}
          icon={<SpeedDialIcon openIcon={<RoomServiceIcon />} />}
          onClose={handleDialClose}
          onOpen={handleDialOpen}
          open={openDial}
          direction="up"
        >
          {actions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              tooltipOpen
              onClick={action.onClick}
              TooltipProps={{
                sx: {
                  "& .MuiTooltip-tooltip": {
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    bgcolor: "background.paper",
                    color: "text.primary",
                    boxShadow: 3,
                    borderRadius: "8px",
                    px: 1.5,
                    py: 0.5,
                    whiteSpace: "nowrap",
                  },
                },
              }}
              sx={{
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "grey.100" },
              }}
            />
          ))}
        </SpeedDial>
      </Box>
    </>
  );
}

export default FloatingActions;
