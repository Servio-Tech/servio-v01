import { Outlet } from "react-router-dom";
import { BranchProvider } from "../context/BranchContext";
import { CartProvider } from "../context/CartContext";
import { TenantProvider } from "../context/TenantContext";
import CustomerExperienceTheme from "../theme/CustomerExperienceTheme";

export default function CustomerExperienceRoute() {
  return (
    <CustomerExperienceTheme>
      <TenantProvider>
        <BranchProvider>
          <CartProvider>
            <Outlet />
          </CartProvider>
        </BranchProvider>
      </TenantProvider>
    </CustomerExperienceTheme>
  );
}
