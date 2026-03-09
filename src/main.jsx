import React from "react";
import ReactDOM from "react-dom/client";
import { Helmet, HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import "./fonts/font-style.css";
import useZustandAPIEndpoint from "./context/useZustandAPIEndpoint.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { TourProvider } from "./context/TourContext.jsx";
import { Suspense } from "react";
import { TourSpotlight } from "./components/common/TourSpotlight.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

const queryClient = new QueryClient();

const Logo = import.meta.env.VITE_LOGO;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <HelmetProvider>
        <TourProvider>
          <ThemeProvider>
          <ToastProvider>
            <Helmet>
              <title>Lightem</title>
              <meta
                name="description"
                content="Lightem is a tech company specializing in financial housekeeping software including accounting, inventory, sales, payroll, and more—designed to automate and streamline business operations."
              />
              <meta
                name="keywords"
                content="accounting software, inventory system, sales automation, payroll system, financial management, business automation, Lightem, financial housekeeping, ERP"
              />
              <meta name="author" content="Lightem" />

              {/* Open Graph Tags for Social Media Sharing */}
              <meta
                property="og:title"
                content="Lightem - Financial Housekeeping Software"
              />
              <meta
                property="og:description"
                content="Discover Lightem's powerful tools for accounting, inventory, sales, and payroll automation. Helping businesses grow through smart financial systems."
              />
              <meta
                property="og:image"
                content={window.location.origin + Logo}
              />
              <meta property="og:url" content="https://www.Lightemph.io" />

              {/* Twitter Card Tags for Twitter Sharing */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta
                name="twitter:title"
                content="Lightem - Financial Housekeeping Software"
              />
              <meta
                name="twitter:description"
                content="Lightem offers all-in-one software for accounting, inventory, sales, and payroll—helping businesses simplify operations and stay financially healthy."
              />
              <meta
                name="twitter:image"
                content={window.location.origin + Logo}
              />
            </Helmet>

            <div
              style={{ fontFamily: "Poppins-Regular" }}
              className="scroll-smooth"
            >
              <QueryClientProvider client={queryClient}>
                <App />
                <ReactQueryDevtools />
              </QueryClientProvider>
            </div>
            <TourSpotlight />
          </ToastProvider>
          </ThemeProvider>
        </TourProvider>
      </HelmetProvider>
    </Suspense>
  </React.StrictMode>
);
