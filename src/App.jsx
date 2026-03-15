import { BrowserRouter, Routes, Route, HashRouter } from "react-router-dom";
import HomePage from "./pages/Main/HomePage";
import ViewOrdering from "./components/MainComponents/ViewOrdering";
import PrintBilling from "./components/MainComponents/PrintBilling";
import SalesDashboard from "./components/Dashboards/SalesDashboard";
import TransactionRecords from "./components/Dashboards/TransactionRecords";
import GlobalThemeToggle from "./components/common/GlobalThemeToggle";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route exact path="/" element={<HomePage />} />
        <Route exact path="/ordering" element={<ViewOrdering />} />
        <Route exact path="/printbilling" element={<PrintBilling />} />
        <Route exact path="/salesdashboard" element={<SalesDashboard />} />
        <Route exact path="/transactionrecords" element={<TransactionRecords />} />
      </Routes>
      <GlobalThemeToggle />
    </HashRouter>
  );
};

export default App;
