// Format date today as month day year

export const formatDate = (date) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

export const formatYearMonthDay = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Adding 1 because months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Get month in words
export const getMonthInWords = (date) => {
  const options = { month: "long" };
  return date.toLocaleDateString("en-US", options);
};

export const formatToShortDate = (inputDate) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dateParts = inputDate.split("-");
  const year = dateParts[0];
  const monthIndex = parseInt(dateParts[1], 10) - 1; // Adjust month index to 0-based
  const day = dateParts[2];

  const formattedDate = `${months[monthIndex]} ${day}`;
  return formattedDate;
};

export const getFullYear = (date) => {
  const year = date.getFullYear();
  return year;
};

export const currentDate = new Date(Date.now());
export const dateToday = formatDate(currentDate);
export const fullYear = getFullYear(currentDate);
export const monthInWords = getMonthInWords(currentDate);
export const yearMonthday = formatYearMonthDay(currentDate);
