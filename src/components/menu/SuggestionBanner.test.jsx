import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SuggestionBanner from "./SuggestionBanner";

jest.mock("../../context/SuggestionsContext", () => ({
  useSuggestions: () => ({ suggestedItems: globalThis.__servioSuggestedItems || [] }),
}));
jest.mock("../../context/CartContext", () => ({
  useCart: () => ({ addToCart: globalThis.__servioAddToCart || (() => {}) }),
}));
jest.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ language: globalThis.__servioLanguage || "ar" }),
}));

describe("SuggestionBanner", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.__servioSuggestedItems = [{ id: "item-1", name: "قهوة عربية", price: 12, image: "" }];
    globalThis.__servioAddToCart = jest.fn();
    globalThis.__servioLanguage = "ar";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.__servioSuggestedItems;
    delete globalThis.__servioAddToCart;
    delete globalThis.__servioLanguage;
  });

  const render = () => act(() => root.render(<SuggestionBanner />));
  const click = (element) => act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));

  test("shows Arabic copy, collapses to a counted side control, and reopens", () => {
    render();
    expect(container.textContent).toContain("قد يناسب طلبك");
    expect(container.textContent).toContain("اختيار سريع");
    expect(container.textContent).toContain("اطلب");
    expect(window.getComputedStyle(container.querySelector(".MuiPaper-root")).position).toBe("relative");

    click(container.querySelector('[aria-label="طي الاقتراح"]'));
    const collapsed = container.querySelector('[aria-label="عرض الاقتراحات (1)"]');
    expect(collapsed).not.toBeNull();
    expect(container.textContent).toContain("1");

    click(collapsed);
    expect(container.querySelector('[aria-label="طي الاقتراح"]')).not.toBeNull();
  });

  test("shows English copy and adds the suggested item to the cart", () => {
    globalThis.__servioLanguage = "en";
    render();
    expect(container.textContent).toContain("You may like this");
    expect(container.textContent).toContain("Quick pick");
    expect(container.textContent).toContain("Order");

    click(container.querySelector('button[aria-label="Collapse suggestion"]'));
    const reopen = container.querySelector('button[aria-label="Show suggestions (1)"]');
    expect(reopen).not.toBeNull();
    click(reopen);

    click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Order")));
    expect(globalThis.__servioAddToCart).toHaveBeenCalledWith(globalThis.__servioSuggestedItems[0]);
  });

  test("renders nothing when there are no suggestions", () => {
    globalThis.__servioSuggestedItems = [];
    render();
    expect(container.firstChild).toBeNull();
  });
});
