// --- 1. THE SECURITY GUARD ---
// (function () {
//   const token = localStorage.getItem("authToken");
//   const onLogin = window.location.href.includes("Registration");

//   if (!token && !onLogin) {
//     console.warn("No token found. Redirecting to login...");
//     const loginPath =
//       window.location.origin + "/RegistrationAndLogin/index.html";
//     window.location.href = loginPath;
//   }
// })();

(function checkAuth() {
    const token = localStorage.getItem("authToken");
    
    // If NO token is found, send them to the Login folder
    if (!token) {
        // Use the relative path to your login folder
        window.location.href = "RegistrationAndLogin/index.html";
    }
})();

// --- 2. AUTHENTICATED FETCH HELPER ---
async function authFetch(endpoint, options = {}) {
  const token = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await fetch(
      `https://touragencyservice.onrender.com/api${endpoint}`,
      {
        ...options,
        headers,
      },
    );

    // ONLY redirect on 401 if we are trying to GET (load) the page.
    // If we are DELETING, just let the function handle the error.
    if (response.status === 401 && options.method === "GET") {
      localStorage.removeItem("authToken");
      window.location.href =
        window.location.origin + "/RegistrationAndLogin/index.html";
      return;
    }

    return response; // Return the 401 response so deleteOrder can read it
  } catch (error) {
    throw error;
  }
}

//ORDER CREATION
const orderForm = document.getElementById("order-form");
if (orderForm) {
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const token = localStorage.getItem("authToken");

    if (!token) {
      alert("You must be logged in to submit a report.");
      return;
    }

    // 1. Map Participants from the list (Assuming you have a way of storing names)
    const passengerElements = document.querySelectorAll(
      "#participant-list div",
    );
    const passengers = Array.from(passengerElements).map((el) => ({
      fullName: el.textContent.replace("Remove", "").trim(),
    }));

    // 2. Build the JSON Payload
    const orderData = {
      // Top Level Fields
      source: document.getElementById("order-source").value || "Web Form",
      tourType:
        document.getElementById("tour-type").options[
          document.getElementById("tour-type").selectedIndex
        ].text,
      sellPriceInGel:
        parseFloat(document.getElementById("sale-price").value) || 0,

      // Net Fields (Backend root level)
      ticketNet: parseFloat(document.getElementById("ticket-net").value) || 0,
      ticketSupplier: document.getElementById("ticket-supplier").value,
      hotelNet: parseFloat(document.getElementById("hotel-net").value) || 0,
      hotelSupplier: document.getElementById("hotel-supplier").value,
      transferNet:
        parseFloat(document.getElementById("transfer-net").value) || 0,
      transferSupplier: document.getElementById("transfer-supplier").value,
      insuranceNet:
        parseFloat(document.getElementById("insurance-net").value) || 0,
      insuranceSupplier: document.getElementById("insurance-supplier").value,
      otherServiceNet:
        parseFloat(document.getElementById("other-service-net").value) || 0,
      otherServiceSupplier: document.getElementById("other-service-supplier")
        .value,

      // Nested Party Object
      party: {
        fullName: document.getElementById("full-name").value,
        email:
          document.getElementById("email").value || "no-email@provided.com",
        phone: document.getElementById("phone").value || "000",
        personalNumber: document.getElementById("ID-number").value || "000",
      },
      passengerCount:
        parseInt(document.getElementById("num-travelers").value) || 1,
      startDate: document.getElementById("travel-start").value,
      endDate: document.getElementById("travel-end").value,

      // Nested Tour Object (Crucial for the Backend)
      tour: {
        // Combining Country and City for the destination field
        destination: `${document.getElementById("dest-country").value} - ${document.getElementById("dest-city").value}`,
        supplier: {
          name: "Winglet Partner", // The backend expects a supplier object
        },
      },
      supplier: {
        name: `${document.getElementById("supplier-name").value}`,
      },
      passengers: passengers,
    };
    console.log("SENDING TO SERVER:", JSON.stringify(orderData, null, 2));
    try {
      const response = await fetch(
        "https://businessreportsmanager-oiwy.onrender.com/api/orders",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        },
      );

      if (!response.ok) throw new Error("Order creation failed.");

      const createdOrder = await response.json();
      const newOrderId = createdOrder.id; // Capture the ID from the server!

      // STEP 2: Loop through and send each pending payment
      if (pendingPayments.length > 0) {
        for (const payment of pendingPayments) {
          await fetch(
            `https://businessreportsmanager-oiwy.onrender.com/api/payments/${newOrderId}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payment),
            },
          );
        }
      }

      alert("Order and all Payments submitted successfully!");
      window.location.reload(); // Reset the page
    } catch (err) {
      console.error(err);
      alert("Something went wrong during submission.");
    }
  });
}

// WHOAMI API
async function fetchUserProfile() {
  const nameElement = document.getElementById("user-name");

  // Match this to what you used in your login script!
  const token = localStorage.getItem("authToken");

  if (!token) {
    console.error("No token found under the key 'authToken'.");
    nameElement.textContent = "Guest";
    return;
  }

  try {
    const response = await fetch(
      "https://businessreportsmanager-oiwy.onrender.com/api/Debug/whoami",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      // APIs often return the name inside a "userName", "name", or "data" object
      // Let's try all common spots:
      const displayName =
        data.userName ||
        data.username ||
        data.name ||
        (data.data && data.data.username);

      nameElement.textContent = displayName || "User";
    } else {
      nameElement.textContent = "Guest";
      console.warn("Token invalid or expired. Status:", response.status);
    }
  } catch (error) {
    console.error("Network error:", error);
    nameElement.textContent = "Error";
  }
}

//SAVED CUSTOMERS API
async function fetchSavedCustomers() {
    const listContainer = document.getElementById('saved-customers-list');
    if (!listContainer) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch('https://businessreportsmanager-oiwy.onrender.com/api/orders/saved-customers', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const customers = await response.json();
            
            // Clear the static placeholders
            listContainer.innerHTML = '';

            if (customers.length === 0) {
                listContainer.innerHTML = '<p>No frequent customers found yet.</p>';
                return;
            }

            // Loop through and create the HTML
            customers.forEach(customer => {
                const customerDiv = document.createElement('div');
                const nameToShow = customer.fullName || customer.name || "Unknown Customer";
                customerDiv.innerHTML = `<h2>${nameToShow}</h2>`;
                listContainer.appendChild(customerDiv);
            });
        } else {
            console.error("Failed to fetch customers:", response.status);
        }
    } catch (error) {
        console.error("Error loading saved customers:", error);
    }
}

//GETTING SAVED CUSTOMERS DATA WHEN CREATING ORDER
async function populateCustomerDatalist() {
    const datalist = document.getElementById('customers');
    const nameInput = document.getElementById('full-name');
    
    // If the datalist doesn't exist in HTML, stop here
    if (!datalist) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch('https://businessreportsmanager-oiwy.onrender.com/api/orders/saved-customers', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const customers = await response.json();
            
            // 1. Clear existing options to prevent duplicates
            datalist.innerHTML = '';

            // 2. Loop through the API results
            customers.forEach(customer => {
                // If the API returns an object { fullName: "..." }, use customer.fullName
                // If it returns a string "...", use customer directly
                const name = typeof customer === 'object' ? customer.fullName : customer;
                
                if (name && name.trim() !== "") {
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                }
            });
            
            console.log(`Datalist synced: ${customers.length} customers loaded.`);
        } else {
            console.error("Server error loading customers:", response.status);
        }
    } catch (error) {
        console.error("Network error populating datalist:", error);
    }
}
//FILTER BY RANGE
const filterBtn = document.getElementById("filterBtn");

if (filterBtn) {
  filterBtn.addEventListener("click", async () => {
    const rawStart = document.getElementById("startDate").value;
    const rawEnd = document.getElementById("endDate").value;
    const token = localStorage.getItem("authToken");

    if (!rawStart || !rawEnd) {
      alert("Please select both dates.");
      return;
    }

    // Convert YYYY-MM-DD to MM/DD/YYYY for your specific API
    const formatDate = (dateStr) => {
      const [year, month, day] = dateStr.split("-");
      return `${month}/${day}/${year}`;
    };

    try {
      const params = new URLSearchParams({
        tourName: "", 
        startDate: formatDate(rawStart),
        endDate: formatDate(rawEnd)
      });

      const response = await fetch(`https://businessreportsmanager-oiwy.onrender.com/api/orders/search?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });

      if (!response.ok) throw new Error("Search failed");

      const filteredOrders = await response.json();
      // --- ADD THESE TWO LINES HERE ---
      Orders = filteredOrders; // Updates the global list
      renderTable(Orders);     // Calls your existing "Painter" function
            // --------------------------------

      console.log("Table updated with filtered data.");

    } catch (err) {
      console.error(err);
      alert("Error filtering data.");
    }
  });
}

//EXPORT TO EXCEL
const excelBtn = document.getElementById("excelBtn");

if (excelBtn) {
  excelBtn.addEventListener("click", async () => {
    const rawStart = document.getElementById("startDate").value; // e.g., "2026-03-26"
    const rawEnd = document.getElementById("endDate").value;
    const token = localStorage.getItem("authToken");

    // 1. Build the correct URL and Params
    let finalUrl = "";
    
    if (rawStart && rawEnd) {
      // Endpoint for date range
      const baseUrl = "https://businessreportsmanager-oiwy.onrender.com/api/orders/export-excel/date-range";
      
      // Swagger says "string($date-time)". 
      // We add T00:00:00 to turn a Date into a Date-Time string.
      const params = new URLSearchParams({
        start: `${rawStart}T00:00:00Z`, 
        end: `${rawEnd}T23:59:59Z`
      });

      finalUrl = `${baseUrl}?${params.toString()}`;
      console.log("Exporting Date Range:", finalUrl);
    } else {
      // Fallback to full export
      finalUrl = "https://businessreportsmanager-oiwy.onrender.com/api/orders/export-excel";
      console.log("Exporting All Orders...");
    }

    try {
      excelBtn.innerText = "Exporting...";
      excelBtn.disabled = true;

      const response = await fetch(finalUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error("Export failed");

      // 2. Download the binary file
      const fileBlob = await response.blob();
      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rawStart ? `Orders_${rawStart}_to_${rawEnd}.xlsx` : "Full_Orders_Export.xlsx";
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      a.remove();

    } catch (err) {
      console.error("Export Error:", err);
      alert("Could not export Excel. Check your login session.");
    } finally {
      excelBtn.innerText = "Export Excel";
      excelBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', populateCustomerDatalist);

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', fetchSavedCustomers);

document.addEventListener("DOMContentLoaded", fetchUserProfile);



// ========== WHOAMI API INTEGRATION - END ==========

window.viewTourDetails = async function (id) {
  try {
    const response = await authFetch(`/Tours/${id}`, { method: "GET" });
    if (response.ok) {
      const tour = await response.json();

      // This is the "Full Details" popup
      alert(`
                Full Details for: ${tour.name}
                --------------------------
                Start: ${tour.startDate.split("T")[0]}
                End: ${tour.endDate.split("T")[0]}
                Travelers: ${tour.passengerCount}
                Supplier: ${tour.supplier?.name || "N/A"}
                Hotel Bookings: ${tour.hotelBookings?.length || 0}
                Air Tickets: ${tour.airTickets?.length || 0}
            `);
    } else {
      alert("Could not load details for this tour.");
    }
  } catch (error) {
    console.error("Error fetching details:", error);
  }
};

// ---------------- GLOBALS ----------------
let Orders = []; // Start empty, API will fill this
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let currentSort = { key: null, asc: true };
const CurrencyMap = { GEL: 1, USD: 2, EUR: 3 };
let localPayments = [];
let currentEditingOrderId = null;

// index.js — full version without Tour Type toggle, still with Dark Mode
document.addEventListener("DOMContentLoaded", () => {
  // ========== CALL WHOAMI API ON PAGE LOAD ==========
  fetchAllTours(); // <--- CALLING THE NEW FUNCTION HERE
  // ===================================================

  // ---------- Logout Logic ----------
const logoutLink = document.getElementById("logoutBtnLink");

    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault(); // Stop the '#' from jumping the page
            
            // 1. Clear the token
            localStorage.removeItem('authToken');
            
            // 2. Redirect to the login page inside its folder
            window.location.href = "RegistrationAndLogin/index.html";
        });
    }
});
// ---------- Dark Mode Toggle ----------
const darkModeBtn = document.querySelector(".dark-mode");
darkModeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode-variables");
  darkModeBtn
    .querySelectorAll("span")
    .forEach((s) => s.classList.toggle("active"));
});

// ---------------- LIVE DATA LOADER ----------------
async function fetchAllTours() {
  const tableBody = document.getElementById("orders-body");
  if (!tableBody) return;

  // Use the full URL since your API is on a specific Render domain
  const API_URL = "https://businessreportsmanager-oiwy.onrender.com/api/orders";
  const token = localStorage.getItem("authToken");

  try {
    tableBody.innerHTML = '<tr><td colspan="8">Loading orders...</td></tr>';

    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
    });

    if (response.status === 200) {
      const data = await response.json();
      
      // Update your global Orders variable
      Orders = data; 
      
      // Call your painter function to draw the rows
      renderTable(Orders);
      
    } else if (response.status === 204 || (response.status === 200 && Orders.length === 0)) {
      tableBody.innerHTML = '<tr><td colspan="8">No orders found on server.</td></tr>';
    } else {
      console.error("Server Error:", response.status);
      tableBody.innerHTML = `<tr><td colspan="8" class="danger">Error ${response.status}: Unauthorized or Server Issue</td></tr>`;
    }
  } catch (error) {
    console.error("Connection Error:", error);
    tableBody.innerHTML = '<tr><td colspan="8" class="danger">Connection error. Is the server awake?</td></tr>';
  }
}

// ---------------- UPDATED TABLE LOADER (Mapping API Keys) ----------------
function renderTable(dataArray) {
  const tableBody = document.getElementById("orders-body");
  tableBody.innerHTML = ""; // Clear the "Loading" message

  if (dataArray.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No orders found.</td></tr>';
    return;
  }

  dataArray.forEach((order) => {
    const tr = document.createElement("tr");

    // Formatting dates to look clean (YYYY-MM-DD)
    const startDate = order.startDate ? order.startDate.split("T")[0] : "N/A";
    const endDate = order.endDate ? order.endDate.split("T")[0] : "N/A";

    tr.innerHTML = `
            <td class="primary">${order.orderNo || "Direct"}</td>
            <td>${order.clientName || "Unknown Client"}</td>
            <td>${order.tourName || "Unnamed Tour"}</td>
            <td>${order.grossPrice || "Unknown Price"}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${order.numberOfPax || 0}</td>
        `;
    tableBody.appendChild(tr);
  });
}

// Only load table if the element exists
if (document.getElementById("orders-body")) {
  fetchAllTours();
}

// ---------------- EDIT API LOGIC ----------------
window.startEdit = async function (id) {
  console.log("Attempting to edit Order ID:", id);
  try {
    const response = await authFetch(`/orders/${id}`, { method: "GET" });
    if (!response.ok) throw new Error("Could not fetch order details");

    const order = await response.json();
    console.log("Data received:", order);

    currentEditingOrderId = id;

    // Map 'personParty' from GET response to your form
    const party = order.personParty || {};
    const tour = order.tour || {};

    // Helper to prevent "null" errors
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    };

    // Fill Form Fields
    setVal(
      "customer-name",
      party.firstName ? `${party.firstName} ${party.lastName}` : "",
    );
    setVal("email", party.email);
    setVal("phone", party.phone);

    if (tour.startDate) setVal("travel-start", tour.startDate.split("T")[0]);
    if (tour.endDate) setVal("travel-end", tour.endDate.split("T")[0]);

    setVal("num-travelers", tour.passengerCount);
    setVal("sale-price", order.sellPriceInGel);

    // UI Change: Change "Save" to "Update"
    const submitBtn = document.querySelector(
      '#order-form button[type="submit"]',
    );
    if (submitBtn) {
      submitBtn.textContent = "Update Order";
      submitBtn.classList.add("edit-mode-btn"); // Style this in CSS
    }

    document
      .getElementById("order-form")
      .scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Edit error:", error);
    alert("Failed to load order.");
  }
};

// ---------------- DELETE API LOGIC ----------------
window.deleteOrder = async function deleteOrder(orderId) {
  // 1. Always ask for confirmation before deleting data
  const confirmed = confirm(
    "Are you sure you want to permanently delete this order?",
  );
  if (!confirmed) return;

  try {
    // 2. Call the API (note the /orders/ prefix)
    const response = await authFetch(`/orders/${orderId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      alert("Order deleted successfully!");

      // 3. Refresh the table so the deleted row disappears
      fetchAllTours();
    } else {
      const errorData = await response.json();
      alert("Failed to delete: " + (errorData.message || "Unknown error"));
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("A server error occurred while trying to delete.");
  }
};

// Also load the user name
if (typeof updateUserInfo === "function") updateUserInfo();

// ---------------- SEARCH & DATE FILTER ----------------
// const filterBtn = document.getElementById("filterBtn");

// if (filterBtn) {
//   filterBtn.addEventListener("click", async () => {
//     const startFilter = document.getElementById("startDate").value;
//     const endFilter = document.getElementById("endDate").value;
//     const searchTerm = document.getElementById("searchInput").value.toLowerCase();
//     const token = localStorage.getItem("authToken");

//     // 1. Validation: The API requires dates to work
//     if (!startFilter || !endFilter) {
//       alert("Please select both a Start and End date to filter.");
//       return;
//     }

//     try {
//       // 2. Build the URL for the API
//       // The API expects: /api/orders/date-range?start=YYYY-MM-DD&end=YYYY-MM-DD
//       const params = new URLSearchParams({
//         start: startFilter,
//         end: endFilter
//       });

//       const url = `https://touragencyservice.onrender.com/api/orders/date-range?${params.toString()}`;

//       const response = await fetch(url, {
//         method: "GET",
//         headers: {
//           "Authorization": `Bearer ${token}`,
//           "Accept": "application/json"
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Server Error: ${response.status}`);
//       }

//       // 3. Get the data from the server
//       let ordersFromServer = await response.json();

//       // 4. (Optional) Apply the search term filter locally 
//       // This searches within the results returned by the date range
//       if (searchTerm) {
//         ordersFromServer = ordersFromServer.filter(o => 
//           (o.party?.fullName && o.party.fullName.toLowerCase().includes(searchTerm)) ||
//           (o.tourType && o.tourType.toLowerCase().includes(searchTerm))
//         );
//       }

//       // 5. Update your global variable and reload the table
//       // Make sure 'Orders' (or whatever your global array is called) is updated
//       Orders = ordersFromServer; 
//       currentPage = 1;
      
//       // This must be the name of your function that draws the <tr> rows
//       loadTable(); 

//     } catch (err) {
//       console.error("Filter failed:", err);
//       alert("Could not filter reports. Please check your connection or login status.");
//     }
//   });
// }

// ---------------- SORTING ----------------
function sortTable(key) {
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = true;
  }

  filteredData.sort((a, b) => {
    let v1 = a[key];
    let v2 = b[key];

    if (!isNaN(Date.parse(v1))) {
      v1 = new Date(v1);
      v2 = new Date(v2);
    }

    if (v1 < v2) return currentSort.asc ? -1 : 1;
    if (v1 > v2) return currentSort.asc ? 1 : -1;
    return 0;
  });

  loadTable();
}

// ---------------- PAGINATION ----------------
const prevBtn = document.getElementById("prevBtn");
if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadTable();
    }
  });
}

const nextBtn = document.getElementById("nextBtn");
if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (currentPage < Math.ceil(filteredData.length / ROWS_PER_PAGE)) {
      currentPage++;
      loadTable();
    }
  });
}

// ---------------- EXCEL EXPORT (REAL XLSX) ----------------
// const excelBtn = document.getElementById("excelBtn");
// if (excelBtn) {
//   excelBtn.addEventListener("click", () => {
//     const data = filteredData.map((o) => ({
//       Name: o.customerName,
//       Surname: o.customerSurname,
//       Number: o.customerNumber,
//       "Birth Date": o.customerBirthDate,
//       Email: o.customerMail,
//       "Payment Status": o.paymentStatus,
//       Status: o.status,
//     }));

//     const ws = XLSX.utils.json_to_sheet(data);
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, "Reports");

//     XLSX.writeFile(wb, "reports.xlsx");
//   });
// }

// ---------- Helpers ----------
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const val = (el) => (el ? el.value.trim() : "");
const toMoney = (n) => (isFinite(n) ? Number(n).toFixed(2) : "0.00");

const hasOption = (options, v) =>
  Array.from(options).some(
    (o) => (o.value || o.textContent || "").toLowerCase() === v.toLowerCase(),
  );

const ensureAfterContainer = (afterEl, id, className = "tag-list") => {
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement("div");
    box.id = id;
    box.className = className;
    afterEl.insertAdjacentElement("afterend", box);
  }
  return box;
};

const makeTag = (container, label, onRemove) => {
  const tag = document.createElement("span");
  tag.className = "tag";
  const t = document.createElement("span");
  t.className = "tag-text";
  t.textContent = label;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "tag-remove";
  x.textContent = "×";
  x.addEventListener("click", () => {
    try {
      onRemove?.();
    } finally {
      tag.remove();
    }
  });
  tag.append(t, x);
  container.appendChild(tag);
};

// ---------- Customer toggle logic ----------
const custInput = $("#customer-name");
const customersDL = $("#customers");
const newCustFields = $(".new-customer-fields");
if (custInput && customersDL && newCustFields) {
  const toggleNew = () => {
    newCustFields.hidden = hasOption(customersDL.options, custInput.value);
  };
  custInput.addEventListener("input", toggleNew);
  toggleNew();
}

// ---------- Country → City data & Destinations logic ----------
const CITY_MAP = {
  georgia: ["Tbilisi", "Batumi", "Kutaisi"],
  france: ["Paris", "Lyon", "Nice", "Marseille"],
  italy: ["Rome", "Milan", "Florence", "Venice"],
  spain: ["Madrid", "Barcelona", "Valencia", "Seville"],
  turkey: ["Istanbul", "Antalya", "Ankara", "Izmir"],
};

const populateCities = (countrySel, citySel) => {
  if (!countrySel || !citySel) return;
  while (citySel.options.length) citySel.remove(0);
  citySel.add(new Option("-- City --", ""));
  (CITY_MAP[(countrySel.value || "").toLowerCase()] || []).forEach((city) => {
    citySel.add(new Option(city, city));
  });
  citySel.selectedIndex = 0;
};

const ensureDestSummary = (group) => {
  let sum = group.querySelector(".dest-summary");
  if (!sum) {
    sum = document.createElement("div");
    sum.className = "dest-summary";
    group.appendChild(sum);
  }
  return sum;
};

const updateDestSummary = (group) => {
  const countrySel = group.querySelector('select[name="destinationCountry[]"]');
  const citySel = group.querySelector('select[name="destinationCity[]"]');
  const sum = ensureDestSummary(group);
  const c = countrySel?.selectedOptions[0]?.text || "";
  const city = citySel?.selectedOptions[0]?.text || "";
  sum.textContent =
    c || city ? `Selected: ${c || "—"}${city ? " – " + city : ""}` : "";
};

const destFieldset = $(".destination-fields");
if (destFieldset) {
  const addBtn = $("#add-destination", destFieldset);
  const baseGroup = $(".destination-group", destFieldset);

  const addRemoveBtn = (group) => {
    if (!group.querySelector(".remove-destination")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-remove remove-destination";
      b.textContent = "Remove Destination";
      group.appendChild(b);
    }
    ensureDestSummary(group);
  };

  if (baseGroup) {
    addRemoveBtn(baseGroup);
    populateCities(
      baseGroup.querySelector('select[name="destinationCountry[]"]'),
      baseGroup.querySelector('select[name="destinationCity[]"]'),
    );
    updateDestSummary(baseGroup);
  }

  addBtn?.addEventListener("click", () => {
    const clone = baseGroup.cloneNode(true);
    $$("input, select", clone).forEach((el) => {
      if (el.tagName === "SELECT") el.selectedIndex = 0;
      else el.value = "";
    });
    addRemoveBtn(clone);
    const ctry = clone.querySelector('select[name="destinationCountry[]"]');
    const city = clone.querySelector('select[name="destinationCity[]"]');
    populateCities(ctry, city);
    updateDestSummary(clone);
    addBtn.before(clone);
  });

  destFieldset.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-destination");
    if (!btn) return;
    const group = btn.closest(".destination-group");
    if (!group) return;
    const groups = $$(".destination-group", destFieldset);
    if (groups.length > 1) group.remove();
  });

  destFieldset.addEventListener("change", (e) => {
    const group = e.target.closest(".destination-group");
    if (!group) return;
    if (e.target.matches('select[name="destinationCountry[]"]')) {
      populateCities(
        e.target,
        group.querySelector('select[name="destinationCity[]"]'),
      );
      updateDestSummary(group);
    }
    if (e.target.matches('select[name="destinationCity[]"]'))
      updateDestSummary(group);
  });
}

// ---------- Travelers logic ----------
const travNum = $("#num-travelers");
const travFieldset = $(".additional-travelers");
const addTravelerBtn = $("#add-traveler");
const travList = $("#additional-list");

if (travNum && travFieldset) {
  const sync = () => {
    travFieldset.hidden = Number(travNum.value || 0) <= 1;
  };
  travNum.addEventListener("change", sync);
  sync();
}

addTravelerBtn?.addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "traveler-item";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "additionalTravelerNames[]";
  input.placeholder = "Traveler Name";
  const rem = document.createElement("button");
  rem.type = "button";
  rem.className = "btn-remove";
  rem.textContent = "Remove";
  rem.addEventListener("click", () => row.remove());
  row.append(input, rem);
  travList.appendChild(row);
});

const participantInput = document.getElementById("participant-input");
const addParticipantBtn = document.getElementById("add-participant");
const participantList = document.getElementById("participant-list");

if (participantInput && addParticipantBtn && participantList) {
  addParticipantBtn.addEventListener("click", () => {
    const fullName = participantInput.value.trim();
    if (!fullName) {
      alert("Please enter the participant's full name.");
      return;
    }

    const div = document.createElement("div");
    div.className = "participant-item";

    const span = document.createElement("span");
    span.textContent = fullName;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => div.remove());

    div.append(span, removeBtn);
    participantList.appendChild(div);

    participantInput.value = "";
  });
}

// ---------- Additional Services logic ----------
const servicesSelect = $("#additional-services");
const newServiceInput = $("#new-service");
const addServiceBtn = $("#add-service");

if (servicesSelect && newServiceInput && addServiceBtn) {
  const tagBox = ensureAfterContainer(servicesSelect, "service-tags");
  const addService = (name) => {
    if (!name) return;
    if (hasOption(servicesSelect.options, name)) {
      newServiceInput.value = "";
      return;
    }
    servicesSelect.add(new Option(name, name));
    makeTag(tagBox, name, () => {
      const idx = Array.from(servicesSelect.options).findIndex(
        (o) => o.value === name,
      );
      if (idx > -1) servicesSelect.remove(idx);
    });
    newServiceInput.value = "";
  };
  addServiceBtn.addEventListener("click", () =>
    addService(val(newServiceInput)),
  );
  newServiceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addService(val(newServiceInput));
    }
  });
}

// ---------- Supplier chips logic ----------
const suppliersDL = $("#suppliers");
const addSupplierBtn = $("#add-supplier");
const newSupplierInput = $("#new-supplier");

if (suppliersDL && addSupplierBtn && newSupplierInput) {
  const tagBox = ensureAfterContainer(suppliersDL, "supplier-tags");
  const addSupplier = (name) => {
    if (!name) return;
    if (hasOption(suppliersDL.options, name)) {
      newSupplierInput.value = "";
      return;
    }
    suppliersDL.appendChild(
      Object.assign(document.createElement("option"), { value: name }),
    );
    makeTag(tagBox, name, () => {
      const found = Array.from(suppliersDL.options).find(
        (o) => o.value === name,
      );
      if (found) found.remove();
    });
    newSupplierInput.value = "";
  };
  addSupplierBtn.addEventListener("click", () =>
    addSupplier(val(newSupplierInput)),
  );
  newSupplierInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSupplier(val(newSupplierInput));
    }
  });
}

// ---------- Order source chips logic ----------
const orderSourceInput = $("#order-source");
const sourcesDL = $("#sources");
const addSourceBtn = $("#add-source");
const newSourceInput = $("#new-source");

if (orderSourceInput && sourcesDL && addSourceBtn && newSourceInput) {
  const tagBox = ensureAfterContainer(orderSourceInput, "source-tags");
  const addSource = (name) => {
    if (!name) return;
    if (hasOption(sourcesDL.options, name)) {
      newSourceInput.value = "";
      return;
    }
    sourcesDL.appendChild(
      Object.assign(document.createElement("option"), { value: name }),
    );
    makeTag(tagBox, name, () => {
      const found = Array.from(sourcesDL.options).find((o) => o.value === name);
      if (found) found.remove();
    });
    newSourceInput.value = "";
  };
  addSourceBtn.addEventListener("click", () => addSource(val(newSourceInput)));
  newSourceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSource(val(newSourceInput));
    }
  });
}

// ---------- Component currency toggle ----------
const compCurr = $("#component-currency");
const rateGroup = $(".foreign-rate-group");
if (compCurr && rateGroup) {
  const syncRate = () => {
    rateGroup.hidden = compCurr.value === "GEL";
  };
  compCurr.addEventListener("change", syncRate);
  syncRate();
}
// ===== Company Expenses Logic =====
let expenses = [];
const exchangeRates = { USD: 2.7, EUR: 3.0, GEL: 1 }; // example fixed rates

const expenseReason = document.getElementById("expense-reason");
const expenseAmount = document.getElementById("expense-amount");
const expenseCurrency = document.getElementById("expense-currency");
const addExpenseBtn = document.getElementById("add-expense");
const expensesList = document.getElementById("expenses-list");
const totalExpensesEl = document.getElementById("total-expenses");
const expenseStatus = document.getElementById("expense-status");

if (addExpenseBtn) {
  addExpenseBtn.addEventListener("click", () => {
    const reason = expenseReason.value.trim();
    const amount = parseFloat(expenseAmount.value) || 0;
    const currency = expenseCurrency.value;

    if (!reason || amount <= 0)
      return alert("Please enter valid expense details.");

    const gelAmount = amount * exchangeRates[currency];
    expenses.push({ reason, amount, currency, gelAmount });
    renderExpenses();

    expenseReason.value = "";
    expenseAmount.value = "";
    expenseCurrency.value = "GEL";
  });
}

function renderExpenses() {
  expensesList.innerHTML = "";
  let total = 0;

  expenses.forEach((exp, i) => {
    total += exp.gelAmount;
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `${exp.reason}: ${exp.amount} ${
      exp.currency
    } (${exp.gelAmount.toFixed(
      2,
    )} GEL) <button onclick="removeExpense(${i})">x</button>`;
    expensesList.appendChild(tag);
  });

  totalExpensesEl.textContent = total.toFixed(2);
  updateExpenseStatus(total);
}

window.removeExpense = function (index) {
  expenses.splice(index, 1);
  renderExpenses();
};

function updateExpenseStatus(totalExpenses) {
  const salePriceEl = document.getElementById("sale-price");
  const totalPaidEl = document.getElementById("total-paid");

  if (!salePriceEl || !totalPaidEl || !expenseStatus) return;

  const gross = parseFloat(salePriceEl.value) || 0;
  const totalPaid = parseFloat(totalPaidEl.textContent) || 0;

  if (totalPaid >= gross && totalExpenses >= gross) {
    expenseStatus.textContent = "Fully Covered";
    expenseStatus.className = "status-label status-green";
  } else if (totalPaid > 0 || totalExpenses > 0) {
    expenseStatus.textContent = "Partially Covered";
    expenseStatus.className = "status-label status-orange";
  } else {
    expenseStatus.textContent = "Unpaid";
    expenseStatus.className = "status-label status-red";
  }
}

// LOGOUT LOGIC
const logoutBtn = document.getElementById("logoutBtn");

// We attach the listener to the link or the button
logoutBtn.parentElement.addEventListener("click", (e) => {
  // 1. Prevent the default link behavior
  e.preventDefault();

  // 2. Clear the token from storage
  localStorage.removeItem("authToken");

  // Optional: Clear all session data if you have any
  // localStorage.clear();

  console.log("User logged out. Clearing token...");

  // 3. Redirect to the login/registration page
  window.location.href = "RegistrationAndLogin/index.html";
});

// Customer Payment Logic
let pendingPayments = [];
const addPayment = document.getElementById("add-payment");
if (addPayment) {
  addPayment.addEventListener("click", () => {
    const bankElement = document.getElementById("payment-bank");
    const amountInput = document.getElementById("payment-amount");
    const totalPaidDisplay = document.getElementById("total-paid");

    const amount = parseFloat(amountInput.value);
    const bankName = bankElement.options[bankElement.selectedIndex].text;

    // DEBUG LOGS (You can remove these once it works)
    console.log("Amount:", amount, "Index:", bankElement.selectedIndex);

    // CLEAN CHECK
    if (!amount || amount <= 0 || bankElement.selectedIndex === 0) {
      alert("Please enter a valid amount and select a bank.");
      return;
    }

    // Add to array
    pendingPayments.push({
      price: { currency: 1, amount: amount, exchangeRateToGel: 1 },
      bankName: bankName,
      paidDate: new Date().toISOString().split("T")[0],
    });

    // Update UI Tags
    const list = document.getElementById("payments-list");
    const item = document.createElement("div");
    item.className = "tag-item";
    item.innerHTML = `<b>${bankName}:</b> ${amount} GEL`;
    list.appendChild(item);

    // Update "Paid By Client" Total
    const totalPaid = pendingPayments.reduce(
      (sum, p) => sum + p.price.amount,
      0,
    );
    totalPaidDisplay.textContent = totalPaid.toFixed(2);

    // Reset inputs
    amountInput.value = "";
    bankElement.selectedIndex = 0;
  });
}

//Paid By Client Display
async function refreshTotalPaid(orderId) {
  const totalPaidElement = document.getElementById("total-paid");
  const token = localStorage.getItem("authToken");

  // The specific GET URL for customer-paid total
  const url = `https://businessreportsmanager-oiwy.onrender.com/api/payments/${orderId}/customer-paid`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();

      // Assuming the API returns a number or an object like { totalPaid: 1000 }
      // If it returns just the number, use 'data'. If it's an object, use 'data.amount' etc.
      const amount =
        typeof data === "number" ? data : data.amount || data.totalPaid || 0;

      // Update the HTML
      totalPaidElement.textContent = amount.toFixed(2);

      console.log(`Updated Total Paid for Order ${orderId}: ${amount} GEL`);
    } else {
      console.warn("Could not fetch total paid status:", response.status);
    }
  } catch (error) {
    console.error("Error updating paid summary:", error);
  }
}
