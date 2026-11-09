import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Helmet, HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./fonts/font-style.css";
import { ToastProvider } from "./context/ToastContext.jsx";
import { TourProvider } from "./context/TourContext.jsx";
import { TourSpotlight } from "./components/common/TourSpotlight.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import AppAlertProvider from "./hooks/AppAlertProvider.jsx";
import { setupAlertOverride } from "./hooks/setupAlertOverride.jsx";

const queryClient = new QueryClient();
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;
const Logo = import.meta.env.VITE_LOGO;

// setup global alert override once before render
setupAlertOverride();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <HelmetProvider>
        <TourProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppAlertProvider>
                <Helmet>
                  <title>Richwell Colleges POS</title>
                  <meta
                    name="description"
                    content="Richwell Colleges POS — hotel and restaurant ordering, billing, and sales."
                  />
                  <meta
                    name="keywords"
                    content="Richwell Colleges, POS, hotel, restaurant, ordering, billing, sales"
                  />
                  <meta name="author" content="Richwell Colleges" />

                  <meta
                    property="og:title"
                    content="Richwell Colleges POS"
                  />
                  <meta
                    property="og:description"
                    content="Richwell Colleges POS — hotel and restaurant ordering, billing, and sales."
                  />
                  <meta
                    property="og:image"
                    content={window.location.origin + Logo}
                  />
                  <meta property="og:url" content="https://www.Lightemph.io" />

                  <meta name="twitter:card" content="summary_large_image" />
                  <meta
                    name="twitter:title"
                    content="Richwell Colleges POS"
                  />
                  <meta
                    name="twitter:description"
                    content="Richwell Colleges POS — hotel and restaurant ordering, billing, and sales."
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
                    {ReactQueryDevtools && (
                      <Suspense fallback={null}>
                        <ReactQueryDevtools />
                      </Suspense>
                    )}
                  </QueryClientProvider>
                </div>

                <TourSpotlight />
              </AppAlertProvider>
            </ToastProvider>
          </ThemeProvider>
        </TourProvider>
      </HelmetProvider>
    </Suspense>
  </React.StrictMode>
);
