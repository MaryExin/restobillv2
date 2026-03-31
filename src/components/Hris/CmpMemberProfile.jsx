"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FaUser,
  FaBriefcase,
  FaBuilding,
  FaPhone,
  FaCalendarAlt,
  FaIdCard,
  FaAddressCard,
  FaBirthdayCake,
  FaEnvelope,
  FaCreditCard,
} from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { motion } from "framer-motion";
import { Avatar } from "@mui/material";

import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import useCustomQuery from "../../hooks/useCustomQuery";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";
import useZustandCompanyCode from "../../context/useZustandCompanyCode";

import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalUpdateTask from "../Modals/ModalUpdateTask";
import ModalPayslip from "../Modals/ModalPayslip";

const ComponentToPrint = React.forwardRef(({ text }, ref) => {
  return (
    <div ref={ref} className="flex w-full flex-col justify-center px-1 pt-2">
      <div className="w-full px-5">{text}</div>
    </div>
  );
});

ComponentToPrint.displayName = "ComponentToPrint";

const getTimeDifference = (start, end) => {
  if (!start || !end) return 0;

  const parseTime = (value) => {
    const parts = String(value).trim().split(/:| /);
    let hour = Number.parseInt(parts[0] || "0", 10);
    const minute = Number.parseInt(parts[1] || "0", 10);
    const second = Number.parseInt(parts[2] || "0", 10);
    const meridian = String(value).toUpperCase();

    if (meridian.includes("PM") && hour < 12) hour += 12;
    if (meridian.includes("AM") && hour === 12) hour = 0;

    const date = new Date();
    date.setHours(hour, minute, second, 0);
    return date;
  };

  const startDate = parseTime(start);
  const endDate = parseTime(end);

  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
};

const CmpMemberProfile = () => {
  const { id: empId } = useParams();

  const { endpoint } = useZustandAPIEndpoint();
  const { companyGlobalCode, setGlobalCompanyCode } = useZustandCompanyCode();
  const { userId, roles } = useZustandLoginCred();

  // ✅ SAFE API HOST RESOLVER
  const apiHost = useMemo(() => {
    const candidates = [
      localStorage.getItem("apiendpoint"),
      endpoint,
      import.meta.env.VITE_LOCALAPIENDPOINT,
      import.meta.env.VITE_WEBAPIENDPOINT,
    ];

    const validBase = candidates.find((value) => {
      const cleaned = String(value || "").trim();

      return (
        cleaned &&
        cleaned !== "null" &&
        cleaned !== "undefined" &&
        !cleaned.includes("undefined")
      );
    });

    return String(validBase || "").replace(/\/+$/, "");
  }, [endpoint]);

  // ✅ SAFE URL BUILDER
  const buildApiUrl = useMemo(() => {
    return (path = "") => {
      const cleanPath = String(path || "").trim();

      if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
      if (!apiHost) return cleanPath || "";

      if (
        !cleanPath ||
        cleanPath === "null" ||
        cleanPath === "undefined" ||
        cleanPath.includes("undefined")
      ) {
        return apiHost;
      }

      return `${apiHost}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
    };
  }, [apiHost]);

  /******* States Start *******/
  const [searchTerm, setSearchTerm] = useState("");
  const [tabSelected, setTabSelected] = useState("Employee Info");
  const [isModalYesNoOpen, setYesNoModalOpen] = useState(false);
  const [isYesNoModalPassResetOpen, setYesNoModalPassResetOpen] =
    useState(false);
  const [isAssignTasks, setIsAssignTasks] = useState(false);
  const [isAssignProjectTasks, setIsAssignProjectTasks] = useState(false);
  const [isModalPrint, setisModalPrint] = useState(false);

  const [isTaskYesNoModalOpen, setTaskYesNoModalOpen] = useState(false);
  const [approvalType, setApprovalType] = useState("");
  const [taskGrade, setTaskGrade] = useState(0);
  const [updateTaskId, setUpdateTaskId] = useState("");
  const [updateEmpId, setUpdateEmpId] = useState("");
  const [taskType, setTaskType] = useState("");

  const [taskId, setTaskId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskStart, setTaskStart] = useState("");
  const [taskTarget, setTaskTarget] = useState("");
  const [taskComments, setTaskComments] = useState("");

  const [othersMenu, setOthersMenu] = useState("");

  const [busunit, setBusunit] = useState("");
  const [busunitCode, setBusunitCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [project, setProject] = useState("");

  const [companyCode, setCompanyCode] = useState(
    localStorage.getItem("companycode") || "",
  );

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);

  const [activeButton, setActiveButton] = useState();
  const [pages, setPages] = useState([1, 2, 3, 4, 5]);
  const [pageItems, setPageItems] = useState(5);
  const [indexPage, setIndexPage] = useState(0);

  /******* Static / sample partner data *******/
  const partners = [
    {
      id: 1,
      name: "Tasty Bites Catering",
      email: "contact@tastybites.com",
      phone: "+63 912 345 6789",
      commission: 10,
      status: "active",
      referred: {
        ABCCompany: { Jan: 1000, Feb: 1000 },
        XYZCompany: { Jan: 2000, Feb: 3000 },
      },
    },
    {
      id: 2,
      name: "Fresh Farm Produce",
      email: "partners@freshfarm.com",
      phone: "+63 923 456 7890",
      commission: 10,
      status: "active",
      referred: {
        OrganicCorp: { Jan: 1500, Feb: 2000 },
        GreenMarket: { Jan: 2500, Feb: 3500 },
      },
    },
    {
      id: 3,
      name: "Gourmet Delights",
      email: "sales@gourmetdelights.com",
      phone: "+63 934 567 8901",
      commission: 10,
      status: "active",
      referred: {
        LuxuryEats: { Jan: 1200, Feb: 1300 },
        FineDiningCo: { Jan: 2200, Feb: 2800 },
      },
    },
    {
      id: 4,
      name: "Pinoy Food Express",
      email: "partners@pinoyfoodexpress.com",
      phone: "+63 945 678 9012",
      commission: 10,
      status: "active",
      referred: {
        StreetFoodHub: { Jan: 1700, Feb: 1800 },
        LocalEats: { Jan: 2700, Feb: 3200 },
      },
    },
    {
      id: 5,
      name: "Sweet Treats Bakery",
      email: "info@sweettreats.com",
      phone: "+63 956 789 0123",
      commission: 10,
      status: "active",
      referred: {
        CakeLovers: { Jan: 2000, Feb: 2100 },
        PastryHouse: { Jan: 2500, Feb: 2600 },
      },
    },
  ];

  const calculateCommission = (partnerList) => {
    return partnerList.map((partner) => {
      let totalSales = 0;

      for (const company in partner.referred) {
        for (const month in partner.referred[company]) {
          totalSales += partner.referred[company][month];
        }
      }

      const commissionEarned = (totalSales * partner.commission) / 100;
      const monthlyPayment = commissionEarned / 2;

      return {
        ...partner,
        totalSales,
        commissionEarned,
        earnings: commissionEarned,
        monthlyPayment,
      };
    });
  };

  const partnersWithCommission = calculateCommission(partners);

  const totalCommissionEarnings = partnersWithCommission.reduce(
    (total, partner) => total + partner.commissionEarned,
    0,
  );

  const filteredPartners = partnersWithCommission.filter(
    (partner) =>
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getCommissionTierClass = (commission) => {
    if (commission >= 20) return "bg-green-100 text-green-800";
    if (commission >= 15) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  /******* Queries / mutations *******/
  const {
    data: subscriptionData,
    isLoading: subscriptionIsLoading,
    isError: subscriptionIsError,
    isSuccess: subscriptionIsSuccess,
  } = useCustomQuery(
    buildApiUrl(import.meta.env.VITE_GET_SUBSCRIPTIONS_ENDPOINT),
    "subscriptions",
  );

  const {
    data: busUnitsData,
    isLoading: busUnitsIsLoading,
    isError: busUnitsIsError,
    isSuccess: busUnitsIsSuccess,
    refetch: busUnitsRefetch,
  } = useCustomQuery(
    buildApiUrl(import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT),
    "busunits",
  );

  const {
    data: projectsData,
    isLoading: projectsIsLoading,
    isError: projectsIsError,
    isSuccess: projectsIsSuccess,
  } = useCustomQuery(
    buildApiUrl(import.meta.env.VITE_PARAMS_PROJECTS_DATA_READ_ENDPOINT),
    "projects",
  );

  const {
    data: taskData,
    isLoading: taskIsLoading,
    isError: taskIsError,
    isSuccess: taskIsSuccess,
    mutate: taskMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MUTATE_TASK_ASSIGNMENT_ENDPOINT),
    "POST",
  );

  const {
    data: projectTasksData,
    isLoading: projectTasksIsLoading,
    isError: projectTasksIsError,
    isSuccess: projectTasksIsSuccess,
    mutate: projectTasksMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_PROJECT_TASKS_ASSIGNMENT_READ_MUTATION),
    "POST",
  );

  const {
    data: updateTaskData,
    isLoading: updateTaskIsLoading,
    isError: updateTaskIsError,
    isSuccess: updateTaskIsSuccess,
    mutate: updateTaskMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MUTATE_TASK_ASSIGNMENT_ENDPOINT),
    "PATCH",
  );

  const {
    data: memberData,
    isLoading: memberIsLoading,
    isError: memberIsError,
    isSuccess: memberIsSuccess,
    mutate: memberMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MEMBER_PROFILE_ENDPOINT),
    "POST",
  );

  const {
    data: userData,
    isLoading: userIsLoading,
    isError: userIsError,
    isSuccess: userIsSuccess,
    mutate: userMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_USER_DATA_READ_MUTATION),
    "POST",
  );

  const {
    data: EESchedSummaryData,
    isLoading: EESchedSummaryIsLoading,
    isError: EESchedSummaryIsError,
    isSuccess: EESchedSummaryIsSuccess,
    mutate: EESchedSummaryMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MUTATE_EMPLOYEE_SCHED_SUMMARY_ENDPOINT),
    "POST",
  );

  const {
    data: EEActualSummaryData,
    isLoading: EEActualSummaryIsLoading,
    isError: EEActualSummaryIsError,
    isSuccess: EEActualSummaryIsSuccess,
    mutate: EEActualSummaryMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MUTATE_EMPLOYEE_ACTUAL_SUMMARY_ENDPOINT),
    "POST",
  );

  const {
    data: EEPayslipSummaryData,
    isLoading: EEPayslipSummaryIsLoading,
    isError: EEPayslipSummaryIsError,
    isSuccess: EEPayslipSummaryIsSuccess,
    mutate: EEPayslipSummaryMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_MUTATE_EMPLOYEE_PAYSLIP_ENDPOINT),
    "POST",
  );

  const {
    data: passResetData,
    isLoading: passResetIsLoading,
    isError: passResetIsError,
    isSuccess: passResetIsSuccess,
    mutate: passwordMutate,
  } = useSecuredMutation(
    buildApiUrl(import.meta.env.VITE_PASSWORD_RESET_ENDPOINT),
    "POST",
  );

  const {
    data: mutationData,
    isLoading: mutationIsLoading,
    isError: mutationIsError,
    isSuccess: mutationIsSuccess,
    mutate,
  } = useCustomSecuredMutation(
    buildApiUrl(import.meta.env.VITE_TASK_ASSIGNMENT_DATA_ENDPOINT),
  );

  /******* Safe derived data *******/
  const member = Array.isArray(memberData) && memberData.length > 0
    ? memberData[0]
    : null;

  const emp = Array.isArray(userData?.empdata) && userData.empdata.length > 0
    ? userData.empdata[0]
    : null;

  /******* Effects *******/
  useEffect(() => {
    if (Array.isArray(subscriptionData)) {
      const yrs = Array.from(
        new Set(
          subscriptionData
            .filter((sub) => sub?.due_date)
            .map((sub) => new Date(sub.due_date).getFullYear()),
        ),
      ).sort((a, b) => a - b);

      setYears(yrs);
    } else {
      setYears([]);
    }
  }, [subscriptionData]);

  useEffect(() => {
    if (project && member?.teamid) {
      projectTasksMutate({
        projectid: project,
        teamid: member.teamid,
      });
    }
  }, [project, member?.teamid, projectTasksMutate]);

  useEffect(() => {
    if (updateTaskData?.message === "Success" && member?.empid) {
      alert("Task updated");

      mutate({
        pageIndex: 1,
        pageItems,
        empid: member.empid,
      });
    }
  }, [updateTaskData, mutate, pageItems, member?.empid]);

  useEffect(() => {
    if (taskData?.message === "Success") {
      alert("Task assigned successfully");
    }
  }, [taskData]);

  useEffect(() => {
    if (empId) {
      memberMutate({ empId });
    }
  }, [empId, memberMutate]);

  useEffect(() => {
    if (empId) {
      userMutate({ empid: empId });
    }
  }, [empId, userMutate]);

  useEffect(() => {
    if (member?.empid && mutationData) {
      mutate({
        pageIndex: 1,
        pageItems,
        empid: member.empid,
      });
    }
  }, [pageItems, member?.empid]);

  useEffect(() => {
    if (tabSelected === "Tasks" && member?.empid) {
      mutate({
        pageIndex: 1,
        pageItems,
        empid: member.empid,
      });
    }
  }, [tabSelected, indexPage, pageItems, member?.empid, mutate]);

  useEffect(() => {
    if (passResetData) {
      alert("Password reset success!");
    }
  }, [passResetData]);

  /******* Helpers *******/
  const handleFilterImageURL = (imagePath) => {
    if (!imagePath) return "";

    const clean = String(imagePath || "");
    const imageName = clean.includes("images/employees/")
      ? clean.split("images/employees/")[1]
      : clean.split("/").pop();

    const imageBase = buildApiUrl(import.meta.env.VITE_IMAGE_URLS || "");
    return `${String(imageBase).replace(/\/+$/, "")}/${String(imageName || "").replace(/^\/+/, "")}`;
  };

  const handleReset = () => {
    setTaskName("");
    setTaskStart("");
    setTaskTarget("");
    setTaskComments("");
    setProject("");
    setTaskId("");
    setIsAssignTasks(false);
    setIsAssignProjectTasks(false);
    setTaskGrade(0);
    setApprovalType("");
  };

  const handleNormalTasksSubmit = () => {
    if (
      taskName !== "" ||
      taskStart !== "" ||
      taskTarget !== "" ||
      taskComments !== ""
    ) {
      if (!member?.empid) return;

      taskMutate({
        empid: member.empid,
        taskid: isAssignProjectTasks ? taskId : "none",
        taskname: taskName.toUpperCase(),
        tasktype: isAssignProjectTasks ? "Project" : "Normal",
        startdate: taskStart,
        targetdate: taskTarget,
        comments: taskComments.toUpperCase(),
        email: emp?.email,
      });

      mutate({
        pageIndex: indexPage + 1,
        pageItems,
        empid: member.empid,
      });

      handleReset();
    } else {
      alert("Fill up empty field");
    }
  };

  const handleTaskApproval = (empIdValue, taskIdValue) => {
    updateTaskMutate({
      empid: empIdValue,
      taskid: taskIdValue,
      approvaltype: approvalType,
      grade: approvalType === "Completed" ? 0 : taskGrade,
    });

    handleReset();
  };

  const incrementNumbers = () => {
    const updatedPages = pages.map((number) => number + 5);
    setPages(updatedPages);
  };

  const decrementNumbers = () => {
    if (pages[0] !== 1) {
      const updatedPages = pages.map((number) => number - 5);
      setPages(updatedPages);
    }
  };

  const startpage = () => {
    setIndexPage(0);
    setPages([1, 2, 3, 4, 5]);
  };

  const formatDate = (date) => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const formatDateMonthDayYear = (inputDate) => {
    if (!inputDate) return "";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(inputDate).toLocaleDateString("en-US", options);
  };

  const formatYearMonthDay = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getMonthInWords = (date) => {
    const options = { month: "long" };
    return date.toLocaleDateString("en-US", options);
  };

  const currentDate = new Date();
  const dateToday = formatDate(currentDate);
  const monthInWords = getMonthInWords(currentDate);
  const yearMonthday = formatYearMonthDay(currentDate);

  const handleSearch = (value) => {
    console.log("Searching for:", value);
  };

  const handlePassReset = () => {
    if (!emp?.empid || !emp?.email) return;

    passwordMutate({
      userId: emp.empid,
      email: emp.email.toLowerCase(),
    });
  };

  const isLoading =
    taskIsLoading ||
    projectTasksIsLoading ||
    updateTaskIsLoading ||
    mutationIsLoading ||
    EEActualSummaryIsLoading ||
    EESchedSummaryIsLoading ||
    EEPayslipSummaryIsLoading ||
    memberIsLoading ||
    userIsLoading;

  /******* UI helpers *******/
  const glass =
    "rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.08)]";
  const glassStrong =
    "rounded-3xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-[0_24px_90px_rgba(15,23,42,0.10)]";
  const pill =
    "inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur";
  const softBtn =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-colorBrand/30";
  const ghostBtn =
    softBtn +
    " bg-white/70 text-slate-700 border border-white/60 hover:bg-white/90";

  const shell = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  const SideNavButton = ({ active, icon, label, onClick }) => (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
        active
          ? "bg-gradient-to-r from-colorBrand/15 via-colorBrand/10 to-transparent ring-1 ring-colorBrand/25"
          : "hover:bg-white/70",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-10 w-10 place-items-center rounded-2xl ring-1 transition",
          active
            ? "bg-colorBrand/10 ring-colorBrand/20 text-colorBrand"
            : "bg-slate-900/5 ring-slate-200/70 text-slate-500 group-hover:text-colorBrand",
        ].join(" ")}
      >
        {icon}
      </span>
      <span
        className={[
          "min-w-0 flex-1 text-sm font-semibold",
          active ? "text-slate-900" : "text-slate-700",
        ].join(" ")}
      >
        {label}
      </span>
      {active ? (
        <span className="h-2 w-2 rounded-full bg-colorBrand shadow-[0_0_0_4px_rgba(215,85,41,0.15)]" />
      ) : null}
    </motion.button>
  );

  return (
    <>
      {isModalPrint && (
        <ModalPayslip
          setisModalPrint={setisModalPrint}
          EEPayslipSummaryData={EEPayslipSummaryData}
          dateFrom={dateFrom}
          dateTo={dateTo}
          memberData={memberData}
          busunit={busunit}
        />
      )}

      {isYesNoModalPassResetOpen && (
        <ModalYesNoReusable
          header={"Confirmation"}
          message={"Reset password?"}
          setYesNoModalOpen={setYesNoModalPassResetOpen}
          triggerYesNoEvent={handlePassReset}
        />
      )}

      {isTaskYesNoModalOpen && (
        <ModalUpdateTask
          header={"Update"}
          message={
            approvalType === "Completed"
              ? "Mark this task as completed?"
              : "Select a grade then submit"
          }
          setYesNoModalOpen={setTaskYesNoModalOpen}
          triggerYesNoEvent={handleTaskApproval}
          taskGrade={taskGrade}
          setTaskGrade={setTaskGrade}
          approvalType={approvalType}
          empId={updateEmpId}
          taskId={updateTaskId}
        />
      )}

      <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-br from-orange-400/18 via-pink-400/10 to-purple-400/10 blur-3xl" />
          <div className="absolute top-[15%] right-[-12%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-cyan-400/10 via-blue-400/10 to-purple-400/10 blur-3xl" />
          <div className="absolute bottom-[-18%] left-[-10%] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-amber-300/14 via-orange-400/10 to-rose-400/10 blur-3xl" />
        </div>

        {isModalYesNoOpen && (
          <ModalYesNoReusable
            header={"Confirmation"}
            message={"Select yes to proceed or no to exit"}
            setYesNoModalOpen={setYesNoModalOpen}
            triggerYesNoEvent={handleNormalTasksSubmit}
          />
        )}

        {member && (
          <div className="relative mx-auto w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-6">
            {isLoading && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className={[glassStrong, "w-full max-w-sm p-5"].join(" ")}>
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-colorBrand" />
                    <div className="text-sm font-semibold text-slate-700">
                      Loading...
                    </div>
                  </div>
                </div>
              </div>
            )}

            <motion.div
              variants={shell}
              initial="hidden"
              animate="show"
              className={[glassStrong, "mb-5 overflow-hidden"].join(" ")}
            >
              <div className="relative p-5 sm:p-6">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-colorBrand/12 via-transparent to-purple-500/8" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500">
                      HRIS • Member Profile
                    </div>
                    <div className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                      {member?.firstname} {member?.middlename} {member?.lastname}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className={pill}>
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Active
                      </span>
                      <span className={pill}>
                        <FaIdCard className="opacity-70" />
                        ID: {member?.empid}
                      </span>
                      <span className={pill}>
                        <FaBriefcase className="opacity-70" />
                        {member?.position}
                      </span>
                      <span className={pill}>
                        <FaBuilding className="opacity-70" />
                        {member?.department}
                      </span>
                      <span className={pill}>
                        <FaCalendarAlt className="opacity-70" />
                        {dateToday}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setYesNoModalPassResetOpen(true)}
                      className={ghostBtn}
                    >
                      <FaGear className="opacity-70" />
                      Password reset
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[290px_1fr]">
              <motion.aside
                variants={shell}
                initial="hidden"
                animate="show"
                className={[glass, "sticky top-4 h-fit p-3"].join(" ")}
              >
                <div className="px-2 pb-3 pt-2">
                  <div className="text-sm font-bold text-slate-900">
                    Navigation
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Switch sections quickly.
                  </div>
                </div>

                <div className="space-y-2">
                  <SideNavButton
                    active={tabSelected === "Employee Info"}
                    icon={<FaUser />}
                    label="Employee Info"
                    onClick={() => {
                      setTabSelected("Employee Info");
                      setOthersMenu("");
                      EESchedSummaryMutate({
                        empid: "",
                        busunitcode: busunitCode,
                        datefrom: "",
                        dateto: "",
                      });
                      EEActualSummaryMutate({
                        empid: "",
                        busunitcode: busunitCode,
                        datefrom: "",
                        dateto: "",
                      });
                      EEPayslipSummaryMutate({
                        empid: "",
                        busunitcode: busunitCode,
                        datefrom: "",
                        dateto: "",
                      });
                    }}
                  />

                  <SideNavButton
                    active={tabSelected === "Account"}
                    icon={<FaGear />}
                    label="Account Info"
                    onClick={() => setTabSelected("Account")}
                  />
                </div>

                {tabSelected === "Tasks" && (
                  <div className="mt-4 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Quick Stats
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Pending</span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {Array.isArray(mutationData)
                            ? mutationData.filter((t) => t.status === "Pending")
                                .length
                            : 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Completed</span>
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          {Array.isArray(mutationData)
                            ? mutationData.filter(
                                (t) => t.status === "Completed",
                              ).length
                            : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.aside>

              <motion.main
                variants={shell}
                initial="hidden"
                animate="show"
                className={[glass, "overflow-hidden"].join(" ")}
              >
                <div className="relative border-b border-white/50 p-5 sm:p-6">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-colorBrand/10 via-transparent to-blue-500/8" />
                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-white/60">
                          <Avatar
                            alt={member?.firstname || "Employee"}
                            src={handleFilterImageURL(member?.image_filename)}
                            sx={{ width: 76, height: 76, boxShadow: 5 }}
                          />
                        </div>
                        <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-green-500 ring-4 ring-white/80" />
                      </div>

                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-900">
                          {member?.firstname} {member?.middlename}{" "}
                          {member?.lastname}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className={pill}>
                            <FaPhone className="opacity-70" />
                            {member?.contact_no || "-"}
                          </span>
                          <span className={pill}>
                            <FaEnvelope className="opacity-70" />
                            {emp?.email || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-colorBrand/10 px-3 py-1 text-xs font-semibold text-colorBrand ring-1 ring-colorBrand/15">
                        Active Employee
                      </span>
                      <span className="inline-flex items-center rounded-full bg-colorBrand/10 px-3 py-1 text-xs font-semibold text-colorBrand ring-1 ring-colorBrand/15">
                        {member?.department || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {tabSelected === "Employee Info" && emp && (
                    <motion.div
                      key="employee-info"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 backdrop-blur-xl shadow-sm">
                          <div className="mb-4">
                            <div className="text-sm font-bold text-slate-900">
                              Personal Details
                            </div>
                            <div className="text-xs text-slate-500">
                              Core employee profile fields.
                            </div>
                          </div>

                          <div className="space-y-3">
                            {[
                              {
                                icon: <FaUser />,
                                label: "First Name",
                                value: emp.firstname,
                              },
                              {
                                icon: <FaUser />,
                                label: "Middle Name",
                                value: emp.middlename,
                              },
                              {
                                icon: <FaUser />,
                                label: "Last Name",
                                value: emp.lastname,
                              },
                              {
                                icon: <FaBirthdayCake />,
                                label: "Birthdate",
                                value: emp.birthdate,
                              },
                              {
                                icon: <FaAddressCard />,
                                label: "Address",
                                value: emp.address,
                              },
                            ].map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur transition hover:bg-white/80"
                              >
                                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-colorBrand/10 text-colorBrand ring-1 ring-colorBrand/15">
                                  {it.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {it.label}
                                  </div>
                                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                                    {it.value || "-"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 backdrop-blur-xl shadow-sm">
                          <div className="mb-4">
                            <div className="text-sm font-bold text-slate-900">
                              Employment Details
                            </div>
                            <div className="text-xs text-slate-500">
                              Government IDs and status.
                            </div>
                          </div>

                          <div className="space-y-3">
                            {[
                              {
                                icon: <FaBriefcase />,
                                label: "Position",
                                value: emp.position,
                              },
                              {
                                icon: <FaBuilding />,
                                label: "Department",
                                value: emp.department,
                              },
                              {
                                icon: <FaIdCard />,
                                label: "TIN",
                                value: emp.tin,
                              },
                              {
                                icon: <FaIdCard />,
                                label: "PHIC",
                                value: emp.phic,
                              },
                              {
                                icon: <FaIdCard />,
                                label: "SSS",
                                value: emp.sss,
                              },
                              {
                                icon: <FaIdCard />,
                                label: "MDF",
                                value: emp.mdf,
                              },
                              {
                                icon: <FaPhone />,
                                label: "Contact No",
                                value: emp.contact_no,
                              },
                              {
                                icon: <FaEnvelope />,
                                label: "Email",
                                value: emp.email,
                              },
                              {
                                icon: <FaCalendarAlt />,
                                label: "Date Started",
                                value: emp.date_started,
                              },
                            ].map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur transition hover:bg-white/80"
                              >
                                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900/5 text-slate-700 ring-1 ring-slate-200/70">
                                  {it.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {it.label}
                                  </div>
                                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                                    {it.value || "-"}
                                  </div>
                                </div>

                                {it.label === "Date Started" ? (
                                  <span className="rounded-full bg-colorBrand/10 px-3 py-1 text-xs font-semibold text-colorBrand ring-1 ring-colorBrand/15">
                                    {emp.status || "-"}
                                  </span>
                                ) : null}
                              </div>
                            ))}

                            <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur">
                              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900/5 ring-1 ring-slate-200/70">
                                <div
                                  className={`h-3 w-3 rounded-full ${
                                    emp.status === "Active"
                                      ? "bg-green-500"
                                      : "bg-rose-500"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Status
                                </div>
                                <div className="mt-1">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                      emp.status === "Active"
                                        ? "bg-green-100 text-green-800 ring-green-200/60"
                                        : "bg-rose-100 text-rose-800 ring-rose-200/60"
                                    }`}
                                  >
                                    {emp.status || "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {tabSelected === "Account" && (
                    <motion.div
                      key="account"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                      className="space-y-4"
                    >
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-5 backdrop-blur-xl shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              Subscription Summary
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Company Code:{" "}
                              <span className="font-semibold text-slate-800">
                                {companyCode}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="yearFilter"
                              className="text-xs font-bold uppercase tracking-wider text-slate-500"
                            >
                              Year
                            </label>
                            <select
                              id="yearFilter"
                              value={selectedYear}
                              onChange={(e) =>
                                setSelectedYear(Number(e.target.value))
                              }
                              className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none focus:border-colorBrand/40 focus:ring-2 focus:ring-colorBrand/20"
                            >
                              {years.map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/60 bg-white/70 p-2 backdrop-blur-xl shadow-sm">
                        <div className="overflow-x-auto rounded-2xl">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-colorBrand to-colorBrandSecondary text-white">
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">
                                  Plan
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">
                                  Due Date
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">
                                  Amount
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">
                                  Pay
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200/60 bg-white/30">
                              {Array.isArray(subscriptionData) &&
                                subscriptionData
                                  .filter(
                                    (sub) =>
                                      String(sub.company_code || "")
                                        .toLowerCase() ===
                                        String(companyCode || "").toLowerCase() &&
                                      new Date(sub.due_date).getFullYear() ===
                                        Number(selectedYear),
                                  )
                                  .map((sub, idx) => (
                                    <motion.tr
                                      key={idx}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: idx * 0.04 }}
                                      className="text-center transition hover:bg-colorBrand/5"
                                    >
                                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-800">
                                        {sub.plan}
                                      </td>
                                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                        {sub.due_date}
                                      </td>
                                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-800">
                                        ₱{sub.amount}
                                      </td>
                                      <td className="whitespace-nowrap px-6 py-4">
                                        <span
                                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                                            sub.payment_status === "Paid"
                                              ? "bg-green-100 text-green-800 ring-green-200/60"
                                              : "bg-rose-100 text-rose-800 ring-rose-200/60"
                                          }`}
                                        >
                                          {sub.payment_status}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <a
                                            href="https://docs.google.com/forms/d/e/1FAIpQLSdPtLCmftId68_gpN0ojVMSnLJ8rQaDhHtpP6OUOuOZ7vx10w/viewform?usp=sharing&ouid=116607788036914186620"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm transition hover:bg-white"
                                          >
                                            <FaCreditCard className="text-colorBrand transition hover:scale-110" />
                                          </a>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.main>
            </div>

            <div className="mt-6 text-center text-xs text-slate-500">
              Exinnov • HRIS • {new Date().getFullYear()}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CmpMemberProfile;