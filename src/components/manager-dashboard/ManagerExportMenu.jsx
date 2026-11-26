import { useState } from "react";
import {
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";

const OPTIONS = [
  { format: "csv", label: { ar: "CSV — بيانات قابلة للتحليل", en: "CSV — analysis-ready data" }, Icon: InsertDriveFileOutlinedIcon },
  { format: "xlsx", label: { ar: "Excel — جدول منسق", en: "Excel — formatted workbook" }, Icon: TableViewOutlinedIcon },
  { format: "pdf", label: { ar: "PDF — طباعة أو حفظ كملف", en: "PDF — print or save as PDF" }, Icon: PictureAsPdfOutlinedIcon },
];

export default function ManagerExportMenu({ language = "ar", onExport, disabled = false, busy = "" }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const isArabic = language === "ar";

  return (
    <>
      <Button
        variant="outlined"
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlinedIcon />}
        disabled={disabled || Boolean(busy)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        sx={{ minHeight: 42, fontWeight: 800, whiteSpace: "nowrap" }}
      >
        {isArabic ? "تصدير" : "Export"}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        {OPTIONS.map(({ format, label, Icon }) => (
          <MenuItem
            key={format}
            disabled={Boolean(busy)}
            onClick={() => {
              setAnchorEl(null);
              onExport(format);
            }}
          >
            <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
            <ListItemText>{label[isArabic ? "ar" : "en"]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
