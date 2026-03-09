import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  Button,
  CircularProgress,
} from "@mui/material";
import { FaFilter } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import Dropdown from "../../Dropdown/Dropdown";

export const FilterModal = ({ setFilterModal, options }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-5">
      <div
        className="fixed inset-0 bg-gray-800 bg-opacity-50"
        onClick={() => setFilterModal(false)}
      />
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Filter Reports</h2>
          <button
            onClick={() => setFilterModal(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <IoClose size={24} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((option) =>
            option.type === "date" ? (
              <div key={option.key} className="relative w-full mt-5">
                <input
                  type="date"
                  id={option.key}
                  name={option.key}
                  value={option.value}
                  onChange={option.handleChange}
                  className="py-[5px] px-3 w-full rounded-md bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                />
                <label className="text-sm font-medium text-softAccent absolute -left-3 top-[10px] bg-white px-1">
                  {option.label}
                </label>
              </div>
            ) : (
              <Dropdown
                key={option.key}
                label={option.label}
                value={option.value}
                optionsList={option.optionsList}
                optionsField01={option.optionsField01}
                optionsField02={option.optionsField02}
                onChange={option.handleChange}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

const MuiTable = ({ data, columns, filterOptions, onRowClick, isLoading }) => {
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState(columns[0].field);
  const [filterModal, setFilterModal] = useState(false);

  const handleSort = (property) => {
    const isAscending = orderBy === property && order === "asc";
    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleRowClick = (row) => {
    onRowClick(row);
  };

  const sortedData = [...data].sort((a, b) => {
    if (order === "asc") {
      return a[orderBy] > b[orderBy] ? 1 : -1;
    } else {
      return a[orderBy] < b[orderBy] ? 1 : -1;
    }
  });

  return (
    <>
      {filterOptions && (
        <div className="mb-4 mt-5">
          <Button
            variant="outlined"
            startIcon={<FaFilter />}
            onClick={() => setFilterModal(true)}
            sx={{ mb: 2 }}
          >
            Filter
          </Button>
        </div>
      )}
      <Paper sx={{ padding: 2 }}>
        {filterModal && (
          <FilterModal
            setFilterModal={setFilterModal}
            options={filterOptions}
          />
        )}
        <TableContainer sx={{ maxHeight: 700, minHeight: 500 }}>
          {isLoading ? (
            <div className="flex justify-center items-center h-96">
              <CircularProgress />
            </div>
          ) : (
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.field}>
                      {column.sortable ? (
                        <TableSortLabel
                          active={orderBy === column.field}
                          direction={orderBy === column.field ? order : "asc"}
                          onClick={() => handleSort(column.field)}
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.length > 0 ? (
                  sortedData.map((row, index) => (
                    <TableRow
                      key={index}
                      hover
                      onClick={() => handleRowClick(row)}
                      style={{ cursor: "pointer" }}
                    >
                      {columns.map((column) => (
                        <TableCell key={column.field}>
                          {row[column.field]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </>
  );
};

export default MuiTable;
