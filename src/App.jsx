import { Routes, Route, HashRouter, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import GlobalThemeToggle from "./components/common/GlobalThemeToggle";
import GlobalSync from "./components/common/GlobalSync";
import RoleAccessHydrator from "./components/common/RoleAccessHydrator";
import PosLogin from "./pages/PosCore/PosLogin";
import PrivateRoute from "./routes/PrivateRoute";
import KioskFullscreenGuard from "./components/KioskSecondScreen/KioskFullscreenGuard";
import ScreenLoader from "./components/common/ScreenLoader";
import { useKioskSecondScreen } from "./hooks/useKioskSecondScreen";
import useApiHost from "./hooks/useApiHost";
import useZustandLayoutMode from "./context/useZustandLayoutMode";

// Keep login immediately available; load the rest only when its route is opened.
const ViewOrdering = lazy(() => import("./components/MainComponents/ViewOrdering"));
const PrintBilling = lazy(() => import("./components/MainComponents/PrintBilling"));
const SalesDashboard = lazy(() => import("./components/Dashboards/SalesDashboard"));
const TransactionRecords = lazy(() => import("./components/Dashboards/TransactionRecords"));
const PosReadingModal = lazy(() => import("./components/MainComponents/PosReadingModal"));
const PosSelectBusunit = lazy(() => import("./pages/PosCore/PosSelectBusunit"));
const PosHomeScreen = lazy(() => import("./pages/PosCore/PosHomeScreen"));
const PosReservationsPage = lazy(() => import("./pages/PosCore/PosReservationsPage"));
const PosRoomServicePage = lazy(() => import("./pages/PosCore/PosRoomServicePage"));
const PosPayment = lazy(() => import("./components/MainComponents/PosPayment"));
const ProductList = lazy(() => import("./components/MainComponents/Productlist"));
const SyncProductsAndPricing = lazy(() => import("./components/MainComponents/SyncProductsAndPricing"));
const SyncOfflineSalesToWeb = lazy(() => import("./components/MainComponents/SyncOfflineSalesToWeb"));
const CmpEmployeeInfo = lazy(() => import("./components/Hris/CmpEmployeeInfo"));
const MemberQueings = lazy(() => import("./pages/Admin/MemberQueings"));
const MemberProfile = lazy(() => import("./components/Hris/MemberProfile"));
const SecondScreenCart = lazy(() => import("./components/KioskSecondScreen/SecondScreenCart"));

const PrimaryWindowServices = () => {
  // Auto-launch second screen the moment the app opens, if Kiosk Mode is active.
  useKioskSecondScreen();

  // Seed layoutMode from DB on first load; enables persistence across devices/reboots.
  const apiHost = useApiHost();
  const initLayoutMode = useZustandLayoutMode((state) => state.initLayoutMode);
  useEffect(() => {
    if (apiHost) initLayoutMode(apiHost);
  }, [apiHost, initLayoutMode]);

  return (
    <>
      <KioskFullscreenGuard />
      <RoleAccessHydrator />
      <GlobalSync />
      <GlobalThemeToggle />
    </>
  );
};

const AppRoutes = () => {
  const isCustomerDisplay = useLocation().pathname === "/kiosk-display";

  return (
    <>
      {/* A customer display must not start a second backup scheduler or control the main window. */}
      {!isCustomerDisplay && <PrimaryWindowServices />}

      <Suspense fallback={<ScreenLoader />}>
      <Routes>
        <Route exact path="/" element={<PosLogin />} />
        <Route
          path="/ordering"
          element={<PrivateRoute routename="/ordering" />}
        >
          <Route path="/ordering" element={<ViewOrdering />} />
        </Route>
        <Route
          path="/reservations"
          element={<PrivateRoute routename="/reservations" />}
        >
          <Route path="/reservations" element={<PosReservationsPage />} />
        </Route>
        <Route
          path="/room-service"
          element={<PrivateRoute routename="/room-service" />}
        >
          <Route path="/room-service" element={<PosRoomServicePage />} />
        </Route>
        <Route
          path="/printbilling"
          element={<PrivateRoute routename="/printbilling" />}
        >
          <Route path="/printbilling" element={<PrintBilling />} />
        </Route>
        <Route
          path="/salesdashboard"
          element={<PrivateRoute routename="/salesdashboard" />}
        >
          <Route path="/salesdashboard" element={<SalesDashboard />} />
        </Route>
        <Route
          path="/productlist"
          element={<PrivateRoute routename="/productlist" />}
        >
          <Route path="/productlist" element={<ProductList />} />
        </Route>
        <Route
          path="/transactionrecords"
          element={<PrivateRoute routename="/transactionrecords" />}
        >
          <Route path="/transactionrecords" element={<TransactionRecords />} />
        </Route>
        <Route
          path="/posreading"
          element={<PrivateRoute routename="/posreading" />}
        >
          <Route path="/posreading" element={<PosReadingModal />} />
        </Route>
        <Route
          exact
          path="/poscoreselectbusunit"
          element={<PosSelectBusunit />}
        />
        <Route exact path="/poscorehomescreen" element={<PosHomeScreen />} />
        <Route
          path="/payments"
          element={<PrivateRoute routename="/payments" />}
        >
          <Route path="/payments" element={<PosPayment />} />
        </Route>
        {/* Private Routes */}
        <Route
          path="/pricesyncing"
          element={<PrivateRoute routename={"/pricesyncing"} />}
        >
          <Route path="/pricesyncing" element={<SyncProductsAndPricing />} />
        </Route>
        {/* Private Routes */}
        <Route
          path="/salesrecordssyncing"
          element={<PrivateRoute routename={"/salesrecordssyncing"} />}
        >
          <Route
            path="/salesrecordssyncing"
            element={<SyncOfflineSalesToWeb />}
          />
        </Route>

        <Route
          path="/employeeinfo"
          element={<PrivateRoute routename={"/employeeinfo"} />}
        >
          <Route path="/employeeinfo" element={<CmpEmployeeInfo />} />
        </Route>

        <Route
          path="/usersqueu"
          element={<PrivateRoute routename={"/usersqueu"} />}
        >
          <Route path="/usersqueu" element={<MemberQueings />} />
        </Route>

        <Route path="/" element={<PrivateRoute routename={"/pricesyncing"} />}>
          <Route path="/memberprofile/:id" element={<MemberProfile />} />
        </Route>

        {/* Kiosk second-screen display — loaded in the secondary BrowserWindow */}
        <Route path="/kiosk-display" element={<SecondScreenCart />} />
      </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <HashRouter>
    <AppRoutes />
  </HashRouter>
);

export default App;
