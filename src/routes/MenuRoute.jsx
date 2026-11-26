import { MenuProvider } from "../context/MenuContext";
import { OrdersProvider } from "../context/OrdersContext";
import { StoreInfoProvider } from "../context/StoreInfoContext";
import { SuggestionsProvider } from "../context/SuggestionsContext";
import { TablesProvider } from "../context/TablesContext";
import Menu from "../pages/Menu";

export default function MenuRoute() {
  return (
    <MenuProvider>
      <OrdersProvider>
        <StoreInfoProvider>
          <TablesProvider>
            <SuggestionsProvider>
              <Menu />
            </SuggestionsProvider>
          </TablesProvider>
        </StoreInfoProvider>
      </OrdersProvider>
    </MenuProvider>
  );
}
