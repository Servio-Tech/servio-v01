import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
// HOOKS
import { useEffect, useState } from "react";

// MUI COMPONENTS
import { Alert, Box, Typography, IconButton, Rating, TextField, Button, Chip } from "@mui/material";

// ICONS
import CloseIcon from "@mui/icons-material/Close";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

// CONTEXTS
import { useFeedbacks } from "../../context/FeedbackContext";
import { useLanguage } from "../../context/LanguageContext";

const QUICK_TAGS = [
  { ar: "خدمة سريعة", en: "Quick service" },
  { ar: "جودة ممتازة", en: "Great quality" },
  { ar: "المكان مزدحم", en: "Busy venue" },
  { ar: "تأخير في الطلب", en: "Order delay" },
  { ar: "تعامل ممتاز", en: "Friendly staff" },
];

function ReviewSection({ open, close, tableNumber }) {
  const { addFeedback } = useFeedbacks(); 
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const ratingLabels = isEnglish
    ? ["Very poor", "Could be better", "Good", "Very good", "Excellent"]
    : ["سيئة جدًا", "تحتاج إلى تحسين", "جيدة", "جيدة جدًا", "ممتازة"];

  useEffect(() => {
    if (!open) {
      setRating(0);
      setSelectedTags([]);
      setComment("");
      setIsSubmitted(false);
      setSubmitError("");
    }
  }, [open]);

  const handleClose = () => {
    if (!loading && close) close();
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0 || loading) return;
    setLoading(true);
    setSubmitError("");

    // بناء كائن التقييم الجديد
    const newFeedback = {
      table_number: tableNumber || (isEnglish ? "Not specified" : "غير محدد"),
      rating: rating,
      tags: selectedTags,
      comment: comment,
    };

    try {
      const result = await addFeedback(newFeedback);
      if (result?.error) throw result.error;
      setIsSubmitted(true);
    } catch (error) {
      console.error("تعذر إرسال تقييم العميل:", error);
      setSubmitError(isEnglish
        ? "Your review could not be sent. Please try again."
        : "تعذّر إرسال تقييمك. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      slotProps={{
        paper: {
          dir: isEnglish ? "ltr" : "rtl",
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "85dvh",
            overflowY: "auto",
            backgroundColor: "background.paper",
          },
        },
      }}
    >
      <Box
        sx={{
          p: { xs: 2.5, sm: 3 },
          pb: "calc(20px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        {!isSubmitted ? (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
                mb: 2,
                flexShrink: 0,
              }}
            >
              <Typography variant="h5" component="h2" sx={{ fontWeight: 850 }}>
                {isEnglish ? "Share your feedback" : "شاركنا رأيك"}
              </Typography>
              <IconButton
                onClick={handleClose}
                disabled={loading}
                aria-label={isEnglish ? "Close" : "إغلاق"}
                size="small"
                sx={{ backgroundColor: "grey.100" }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                py: 1,
                overflowY: "auto",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  alignItems: "flex-start",
                }}
              >
                <Typography
                  variant="body1"
                  sx={{ color: "text.secondary", fontWeight: "500" }}
                >
                  {isEnglish ? "How was your experience?" : "كيف كانت تجربتك اليوم؟"}
                </Typography>
                <Rating
                  value={rating}
                  onChange={(event, newValue) => setRating(newValue)}
                  readOnly={loading}
                  size="large"
                  aria-label={isEnglish ? "Rate your experience from one to five stars" : "تقييم تجربتك من خمس نجوم"}
                  emptyIcon={
                    <StarBorderRoundedIcon fontSize="inherit" />
                  }
                  sx={{
                    fontSize: "3.2rem",
                    gap: 0.5,
                    color: "#f5a623",
                    "& .MuiRating-iconEmpty": { color: "#a85d00", opacity: 1 },
                    "& .MuiRating-iconEmpty svg": { fill: "none", stroke: "currentColor", strokeWidth: 1.25 },
                    "& .MuiRating-iconFilled": { color: "#f5a623", opacity: 1 },
                    "& .MuiRating-iconHover": { color: "#d97706", opacity: 1 },
                    "& .MuiRating-icon svg": { display: "block", width: "1em", height: "1em", maxWidth: "none" },
                  }}
                />
                <Typography aria-live="polite" variant="body2" sx={{ minHeight: 22, fontWeight: rating ? 800 : 500, color: rating ? "primary.main" : "text.secondary" }}>
                  {rating ? ratingLabels[rating - 1] : (isEnglish ? "Select a star rating to continue." : "اختر عدد النجوم لتتمكن من الإرسال.")}
                </Typography>
              </Box>

              {rating > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontWeight: 700 }}>
                    {isEnglish ? "What stood out? (optional)" : "ما الذي لفت انتباهك؟ (اختياري)"}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: .8, justifyContent: "flex-start" }}>
                    {QUICK_TAGS.map((tag) => {
                      const selected = selectedTags.includes(tag.ar);
                      return (
                    <Chip
                      key={tag.ar}
                      label={isEnglish ? tag.en : tag.ar}
                      clickable
                      aria-pressed={selected}
                      disabled={loading}
                      onClick={() => handleTagToggle(tag.ar)}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      sx={{
                        minHeight: 40,
                        borderRadius: "13px",
                        px: 0.4,
                        fontWeight: 700,
                      }}
                    />
                      );
                    })}
                  </Box>
                </Box>
              )}

              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder={isEnglish ? "Add a comment (optional)" : "هل لديك ملاحظة إضافية؟ (اختياري)"}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                disabled={loading}
                helperText={`${comment.length}/500`}
                slotProps={{ htmlInput: { "aria-label": isEnglish ? "Optional feedback comment" : "ملاحظة إضافية اختيارية", maxLength: 500 } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "15px",
                    backgroundColor: "grey.50",
                  },
                  "& .MuiFormHelperText-root": { textAlign: "end", mx: .5 },
                }}
              />
            </Box>

            {submitError && <Alert severity="error">{submitError}</Alert>}

            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={rating === 0 || loading}
              onClick={handleSubmit}
              sx={{
                borderRadius: "14px",
                minHeight: 52,
                py: 1.2,
                fontWeight: 850,
                fontSize: "1rem",
                flexShrink: 0,
                mt: 1.5,
              }}
            >
              {loading
                ? (isEnglish ? "Sending…" : "جارٍ الإرسال…")
                : (isEnglish ? "Submit review" : "إرسال التقييم")}
            </Button>
          </>
        ) : (
          <Box role="status" sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: { xs: 3, sm: 5 }, gap: .8 }}>
            <CheckCircleRoundedIcon color="success" sx={{ fontSize: "4rem", mb: .5 }} />
            <Typography
              variant="h5"
              sx={{ fontWeight: 900 }}
              color="primary"
            >
              {isEnglish ? "Thank you!" : "شكرًا لك!"}
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "text.secondary", textAlign: "center", maxWidth: 350, lineHeight: 1.7 }}
            >
              {isEnglish
                ? "Your feedback has been received. We hope to see you again."
                : "وصلنا تقييمك، شكرًا لمشاركته. نأمل زيارتك مجددًا."}
            </Typography>
            <Button fullWidth variant="contained" onClick={handleClose} sx={{ mt: 1.5, minHeight: 48, borderRadius: "13px", fontWeight: 850 }}>
              {isEnglish ? "Done" : "تم"}
            </Button>
          </Box>
        )}
      </Box>
    </SwipeableDrawer>
  );
}

export default ReviewSection;
