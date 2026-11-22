import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

function SidebarItem({ navItem, isSelected, onSelect }) {
  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={isSelected}
        onClick={onSelect}
        aria-current={isSelected ? "page" : undefined}
        sx={{
          position: "relative", minHeight: 44, borderRadius: 2, px: 1.4, py: 0.8, gap: 1.4,
          color: isSelected ? "#f1a678" : "#c6beb2",
          transition: "background-color .18s ease, color .18s ease",
          "&:hover": { bgcolor: "rgba(255,255,255,.055)", color: "#f4f0e8" },
          "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "rgba(218,119,65,.14)", color: "#f1a678" },
          "&.Mui-selected::before": { content: '\"\"', position: "absolute", insetInlineStart: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, bgcolor: "#e99462" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, color: "inherit", "& .MuiSvgIcon-root": { fontSize: 21 } }}>{navItem.icon}</ListItemIcon>
        <ListItemText primary={navItem.label} primaryTypographyProps={{ fontSize: ".875rem", fontWeight: isSelected ? 800 : 600, sx: { textAlign: "start", lineHeight: 1.4 } }} />
      </ListItemButton>
    </ListItem>
  );
}

export default SidebarItem;
