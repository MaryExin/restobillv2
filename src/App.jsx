import { BrowserRouter, Routes, Route, HashRouter } from "react-router-dom";
import HomePage from "./pages/Main/HomePage";
import ViewOrdering from "./components/MainComponents/ViewOrdering";
import PrintBilling from "./components/MainComponents/PrintBilling";
import SalesDashboard from "./components/Dashboards/SalesDashboard";
import TransactionRecords from "./components/Dashboards/TransactionRecords";
import GlobalThemeToggle from "./components/common/GlobalThemeToggle";
import PosReadingModal from "./components/MainComponents/PosReadingModal";
import PosLogin from "./pages/PosCore/PosLogin";
import PosSelectBusunit from "./pages/PosCore/PosSelectBusunit";
import PosHomeScreen from "./pages/PosCore/PosHomeScreen";
import PosPayment from "./components/MainComponents/PosPayment";
import ProductList from "./components/MainComponents/ProductList";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route exact path="/" element={<PosLogin />} />
        <Route exact path="/ordering" element={<ViewOrdering />} />
        <Route exact path="/printbilling" element={<PrintBilling />} />
        <Route exact path="/salesdashboard" element={<SalesDashboard />} />
        <Route exact path="/productlist" element={<ProductList />} />
        <Route
          exact
          path="/transactionrecords"
          element={<TransactionRecords />}
        />
        <Route exact path="/posreading" element={<PosReadingModal />} />
        <Route
          exact
          path="/poscoreselectbusunit"
          element={<PosSelectBusunit />}
        />
        <Route exact path="/poscorehomescreen" element={<PosHomeScreen />} />
        <Route exact path="/ " element={<TransactionRecords />} />
        <Route exact path="/payments" element={<PosPayment />} />
      </Routes>
      <GlobalThemeToggle />
    </HashRouter>
  );
};

export default App;
