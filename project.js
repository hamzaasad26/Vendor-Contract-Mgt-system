const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');



const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));


const port = 8080;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(express.json()); // To parse JSON data // Serve static files like login.html

// Database connection
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "26012003",
    database: "vmc"
});

connection.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err.stack);
        return;
    }
    console.log("Connected to the database.");
});

//render the main page 
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/main.html'));
});


// Render the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/login.html'));
});

// Handle login POST request
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check credentials in the User table
    const query = `
        SELECT user_id, user_type FROM User
        WHERE user_email = ? AND user_password = ?;
    `;
    connection.query(query, [email, password], (err, results) => {
        if (err) {
            console.error("Error querying the database:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            return res.status(401).send("Invalid credentials. Please try again.");
        }

        const { user_id, user_type } = results[0];

        // Redirect to role-specific dashboard
        res.redirect(`/dashboard?user_id=${user_id}&user_type=${user_type}`);
    });
});

// Handle Vendor Sign-Up
app.post('/signup', (req, res) => {
    const { vendor_name, address, contact_person, contact_number, vendor_email, password } = req.body;

    // Start a transaction to insert into User and Vendor tables
    connection.beginTransaction((err) => {
        if (err) {
            console.error("Transaction error:", err);
            return res.status(500).send("Internal Server Error");
        }

        // Insert into User table
        const userQuery = `
            INSERT INTO User (user_email, user_password, user_type)
            VALUES (?, ?, 'Vendor');
        `;
        connection.query(userQuery, [vendor_email, password], (err, userResult) => {
            if (err) {
                return connection.rollback(() => {
                    console.error("Error inserting into User table:", err);
                    res.status(500).send("Failed to sign up. Please try again.");
                });
            }

            const userId = userResult.insertId; // Get the auto-generated user_id

            // Insert into Vendor table
            const vendorQuery = `
                INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
                VALUES (?, ?, ?, ?, ?, ?, false, 0);
            `;
            connection.query(
                vendorQuery,
                [userId, vendor_name, address, contact_person, contact_number, vendor_email],
                (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error("Error inserting into Vendor table:", err);
                            res.status(500).send("Failed to sign up. Please try again.");
                        });
                    }

                    // Commit the transaction
                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                console.error("Transaction commit error:", err);
                                res.status(500).send("Internal Server Error");
                            });
                        }

                        res.send("Vendor successfully signed up! You can now log in.");
                    });
                }
            );
        });
    });
});

app.get('/logout', (req, res) => {
    res.redirect('/'); // Redirect to login page
});

// Dashboard route for all user types
app.get('/dashboard', (req, res) => {
    const { user_id, user_type } = req.query;

    if (!user_id || !user_type) {
        return res.status(400).send("Missing user_id or user_type.");
    }

    switch (user_type) {
        case 'Vendor': {
            const vendorDashboardQuery = `
                SELECT v.vendor_name, v.address, v.contactPerson, v.contactNumber, v.vendor_email, 
                    v.complianceStatus, v.rating
                FROM Vendor v
                WHERE v.user_id = ?;
            `;
            connection.query(vendorDashboardQuery, [user_id], (err, results) => {
                if (err) {
                    console.error("Error fetching vendor dashboard data:", err);
                    return res.status(500).send("Error fetching vendor dashboard data.");
                }

                if (results.length === 0) {
                    return res.status(404).send("Vendor not found.");
                }

            

                const vendor = results[0]; // Get the first result
                res.render('vendor', { vendor });
            });
            break;
        }
        case 'VendorManagementTeam': {
            const teamDashboardQuery = `
                SELECT team_name FROM VendorManagementTeam WHERE user_id = ?;
            `;
            connection.query(teamDashboardQuery, [user_id], (err, results) => {
                if (err) {
                    console.error("Error fetching vendor management team data:", err);
                    return res.status(500).send("Error fetching vendor management team data.");
                }

                if (results.length === 0) {
                    return res.status(404).send("Vendor Management Team not found.");
                }

                const team = results[0];
                ;

                res.render('vendor_mgt', { team, user_id });
            });
            break;
        }
        case 'ProcurementManager': {
            const managerDashboardQuery = `
                SELECT pm.department 
                FROM ProcurementManager pm
                WHERE pm.user_id = ?;
            `;
            connection.query(managerDashboardQuery, [user_id], (err, results) => {
                if (err) {
                    console.error("Error fetching procurement manager data:", err);
                    return res.status(500).send("Error fetching procurement manager data.");
                }
        
                if (results.length === 0) {
                    return res.status(404).send("Procurement Manager not found.");
                }
        
                const manager = results[0];
                

                res.render('procurementManager',{manager,user_id});
            });
            break;
        }
        case 'FinanceTeam': {
            const financeDashboardQuery = `
                SELECT ft.finance_id, ft.budget_assigned 
                FROM FinanceTeam ft
                WHERE ft.user_id = ?;
            `;
            connection.query(financeDashboardQuery, [user_id], (err, results) => {
                if (err) {
                    console.error("Error fetching finance team data:", err);
                    return res.status(500).send("Error fetching finance team data.");
                }
        
                if (results.length === 0) {
                    return res.status(404).send("Finance Team member not found.");
                }
        
                const finance = results[0];
                

                res.render('financeUser', {finance, user_id});
            });
            break;
        } 
        case 'ContractManagementTeam': {
            // Query to fetch the assigned contracts for the user
            const contractDashboardQuery = `
                SELECT cmt.team_id, cmt.assigned_contracts
                FROM ContractManagementTeam cmt
                WHERE cmt.user_id = ?;
            `;
        
            connection.query(contractDashboardQuery, [user_id], (err, results) => {
                if (err) {
                    console.error("Error fetching contract management team data:", err);
                    return res.status(500).send("Error fetching contract management team data.");
                }
        
                if (results.length === 0) {
                    return res.status(404).send("Contract Management Team member not found.");
                }
        
                const contractManagement = results[0];
               


                res.render('contractManager',{contractManagement, user_id});
            });
            break;
        }
        

        default:
            res.status(400).send("Invalid user type.");
            break;
    }

});


// View Feedback route
app.get('/view-feedback', (req, res) => {
    const { user_id } = req.query;

    const feedbackQuery = `
        SELECT p.evaluationDate, p.feedback, p.rating, v.vendor_name
        FROM PerformanceEvaluation p
        JOIN Vendor v ON p.vendorID = v.vendorID
        WHERE v.user_id = ?;
    `;

    connection.query(feedbackQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching feedback:", err);
            return res.status(500).send("Internal Server Error");
        }

        res.render('feedback',{feedbackList: results});
    });
});

// View Contracts route
app.get('/view-contracts', (req, res) => {
    const { user_id } = req.query;

    const contractQuery = `
        SELECT c.contractID, c.startDate, c.endDate, c.renewalDate, c.contractStatus, c.approvalStatus
        FROM Contract c
        JOIN Vendor v ON c.vendorID = v.vendorID
        WHERE v.user_id = ?;
    `;

    connection.query(contractQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching contracts:", err);
            return res.status(500).send("Internal Server Error");
        }

        res.render('viewcontracts',{contractList: results});
    });
});

// Request Renewal route // no need to change html to ejs
app.post('/request-renewal', (req, res) => {
    const { contractID } = req.body;

    const renewalQuery = `
        UPDATE Contract
        SET contractStatus = 'Pending Renewal', renewalDate = CURDATE()
        WHERE contractID = ?;
    `;

    connection.query(renewalQuery, [contractID], (err) => {
        if (err) {
            console.error("Error requesting renewal:", err);
            return res.status(500).send("Internal Server Error");
        }

        res.send(`
            <html>
                <head>
                    <title>Renewal Request</title>
                </head>
                <body>
                    <h1>Renewal Request Submitted</h1>
                    <p>Your renewal request has been successfully submitted for Contract ID: ${contractID}</p>
                    <button onclick="window.location.href='/view-contracts'">View Contracts</button>
                </body>
            </html>
        `);
    });
});

// View Purchase Orders route
app.get('/view-purchase-orders', (req, res) => {
    const { user_id } = req.query;

    const purchaseOrderQuery = `
        SELECT po.orderID, po.itemDetails, po.quantity, po.costPerUnit, po.totalCost, po.order_status, po.orderDate
        FROM PurchaseOrder po
        JOIN Vendor v ON po.vendorID = v.vendorID
        WHERE v.user_id = ?;
    `;

    connection.query(purchaseOrderQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching purchase orders:", err);
            return res.status(500).send("Internal Server Error");
        }


        res.render('viewPO', { purchaseOrderList: results });
    });
});

// ######VENDOR MANAGEMENT FUNCTIONS##################

// Manage Vendors

app.get('/manage-vendors', (req, res) => {

    const vendorQuery = `
        SELECT vendorID, vendor_name, address, contactPerson, complianceStatus, rating
        FROM Vendor;
    `;

    connection.query(vendorQuery, (err, results) => {
        if (err) {
            console.error("Error fetching vendors:", err);
            return res.status(500).send("Internal Server Error");
        }

    res.render('manageVendors', { vendorList: results});

    });
});

// Render the edit vendor form - FLAGGED
app.get('/edit-vendor', (req, res) => {
    const vendorID = req.query.vendorID;
    const query = `SELECT * FROM Vendor WHERE vendorID = ?`;

    connection.query(query, [vendorID], (err, results) => {
        if (err) {
            console.error("Error fetching vendor details:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            return res.status(404).send("Vendor not found");
        }

        const vendor = results[0];



        res.render('editVendor', { vendor, vendorID });

    });
});

// Handle vendor update
app.post('/edit-vendor', (req, res) => {
    const vendorID = req.query.vendorID;
    const {vendor_name, address, contactPerson, complianceStatus, rating } = req.body;

    const query = `
        UPDATE Vendor
        SET vendor_name = ?, address = ?, contactPerson = ?, complianceStatus = ?, rating = ?
        WHERE vendorID = ?
    `;

    connection.query(query, [vendor_name, address, contactPerson, complianceStatus ? 1 : 0, rating, vendorID], (err) => {
        if (err) {
            console.error("Error updating vendor:", err);
            return res.status(500).send("Internal Server Error");
        }
        
        res.redirect('/manage-vendors');
    });
});


app.get('/delete-vendor', (req, res) => {
    const vendorID = req.query.vendorID;
    const query = `DELETE FROM Vendor WHERE vendorID = ?`;

    connection.query(query, [vendorID], (err) => {
        if (err) {
            console.error("Error deleting vendor:", err);
            return res.status(500).send("Internal Server Error");
        }
        res.redirect('/manage-vendors');
    });
});

app.post('/add-vendor', (req, res) => {
    const {vendor_name, address, contactPerson, contactNumber, vendor_email, password } = req.body;

    // Start a transaction to insert into User and Vendor tables
    connection.beginTransaction((err) => {
        if (err) {
            console.error("Transaction error:", err);
            return res.status(500).send("Internal Server Error");
        }

        // Insert into User table
        const userQuery = `
            INSERT INTO User (user_email, user_password, user_type)
            VALUES (?, ?, 'Vendor');
        `;
        connection.query(userQuery, [vendor_email, password], (err, userResult) => {
            if (err) {
                return connection.rollback(() => {
                    console.error("Error inserting into User table:", err);
                    res.status(500).send("Failed to add vendor. Please try again.");
                });
            }

            const userId = userResult.insertId; // Get the auto-generated user_id

            // Insert into Vendor table
            const vendorQuery = `
                INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
                VALUES (?, ?, ?, ?, ?, ?, false, 0);
            `;
            connection.query(
                vendorQuery,
                [userId, vendor_name, address, contactPerson, contactNumber, vendor_email],
                (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error("Error inserting into Vendor table:", err);
                            res.status(500).send("Failed to add vendor. Please try again.");
                        });
                    }

                    // Commit the transaction
                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                console.error("Transaction commit error:", err);
                                res.status(500).send("Internal Server Error");
                            });
                        }

                        res.redirect('/manage-vendors'); // Redirect to the vendor management page
                    });
                }
            );
        });
    });
});

app.get('/view-vendor-performance', (req, res) => {

    const { user_id } = req.query; // Ensure user_id is extracted from the query string

    if (!user_id) {
        return res.status(400).send("User ID is required");
    }

    const performanceQuery = `
        SELECT v.vendor_name, p.feedback, p.rating, p.evaluationDate
        FROM PerformanceEvaluation p
        JOIN Vendor v ON p.vendorID = v.vendorID;
    `;

    connection.query(performanceQuery, (err, results) => {
        if (err) {
            console.error("Error fetching performance data:", err);
            return res.status(500).send("Internal Server Error");
        }

    

        res.render('vendorPerformance', { performanceList: results, user_id });
    });
});

// Approve/Reject Vendor Applications - FLAGGED
app.get('/vendor-applications', (req, res) => {

    const { user_id } = req.query; // Extract user_id from query

    if (!user_id) {
        return res.status(400).send("User ID is required");
    }

    const applicationsQuery = `
        SELECT vendorID, vendor_name, complianceStatus
        FROM Vendor
        WHERE complianceStatus = 0; -- Pending
    `;

    connection.query(applicationsQuery, (err, results) => {
        if (err) {
            console.error("Error fetching applications:", err);
            return res.status(500).send("Internal Server Error");
        }


        res.render('vendorapplications', { applicationList: results, user_id});

    });
});

// Approve Vendor- flagged
app.get('/approve-vendor', (req, res) => {
    const { vendorID } = req.query;

    const approveQuery = `
        UPDATE Vendor
        SET complianceStatus = 1
        WHERE vendorID = ?;
    `;

    connection.query(approveQuery, [vendorID], (err) => {
        if (err) {
            console.error("Error approving vendor:", err);
            return res.status(500).send("Internal Server Error");
        }

        res.redirect('/vendor-applications');
    });
});

// Reject Vendor - flagegd
app.get('/reject-vendor', (req, res) => {
    const { vendorID } = req.query;

    const rejectQuery = `
        DELETE FROM Vendor
        WHERE vendorID = ?;
    `;

    connection.query(rejectQuery, [vendorID], (err) => {
        if (err) {
            console.error("Error rejecting vendor:", err);
            return res.status(500).send("Internal Server Error");
        }

        res.redirect('/vendor-applications');
    });
});


// ############################################

app.get('/create-purchase-order', (req, res) => {
    const { user_id } = req.query;

    // Fetch vendor and department details for the dropdowns
    const vendorQuery = `SELECT vendorID, vendor_name FROM Vendor`;
    const departmentQuery = `
        SELECT d.departmentID, d.dept_name 
        FROM Department d 
        JOIN ProcurementManager pm ON d.managerID = pm.manager_id
        WHERE pm.user_id = ?;
    `;

    connection.query(vendorQuery, (vendorErr, vendors) => {
        if (vendorErr) {
            console.error("Error fetching vendors:", vendorErr);
            return res.status(500).send("Error fetching vendor data.");
        }

        connection.query(departmentQuery, [user_id], (deptErr, departments) => {
            if (deptErr) {
                console.error("Error fetching departments:", deptErr);
                return res.status(500).send("Error fetching department data.");
            }

            res.render('createPurchaseOrder', {vendors, departments, user_id});
        });
    });
});


app.post('/submit-purchase-order', (req, res) => {
    const { vendorID, departmentID, itemDetails, quantity, costPerUnit } = req.body;

    // Insert into PurchaseOrder table
    const insertQuery = `
        INSERT INTO PurchaseOrder (vendorID, departmentID, itemDetails, quantity, costPerUnit, budgetValidationStatus, order_status, orderDate)
        VALUES (?, ?, ?, ?, ?, false, 'Pending', CURDATE());
    `;
    connection.query(insertQuery, [vendorID, departmentID, itemDetails, quantity, costPerUnit], (err) => {
        if (err) {
            console.error("Error creating purchase order:", err);
            return res.status(500).send("Error creating purchase order.");
        }
        res.send("Purchase order created successfully.");
    });
});

// done
app.get('/track-purchase-orders', (req, res) => {
    const { user_id } = req.query;

    // Fetch POs for the procurement manager's department
    const query = `
        SELECT po.orderID, po.itemDetails, po.quantity, po.totalCost, po.order_status, po.orderDate, v.vendor_name
        FROM PurchaseOrder po
        JOIN Vendor v ON po.vendorID = v.vendorID
        JOIN Department d ON po.departmentID = d.departmentID
        JOIN ProcurementManager pm ON d.managerID = pm.manager_id
        WHERE pm.user_id = ?;
    `;

    connection.query(query, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching purchase orders:", err);
            return res.status(500).send("Error fetching purchase orders.");
        }

        if (results.length === 0) {
            return res.send("No purchase orders found.");
        }

        res.render('trackPO', { purchaseOrders: results, user_id });
   
        
    });
});

// done
app.get('/validate-budget', (req, res) => {
    const { user_id } = req.query;

    // Fetch budget details for the manager's department
    const query = `
        SELECT b.allocatedAmount, b.spentAmount, b.remainingAmount
        FROM Budget b
        JOIN Department d ON b.departmentID = d.departmentID
        JOIN ProcurementManager pm ON d.managerID = pm.manager_id
        WHERE pm.user_id = ?;
    `;

    connection.query(query, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching budget data:", err);
            return res.status(500).send("Error fetching budget data.");
        }

        if (results.length === 0) {
            return res.send("No budget found for your department.");
        }

        const budget = results[0];
        

        res.render('valid_budget_proc.ejs', { budget, user_id });
    });
});


/// finance team functions ###############
// fxed
app.get('/monitor-budget', (req, res) => {
    const query = `
        SELECT d.dept_name, 
               b.allocatedAmount, 
               b.spentAmount, 
               b.remainingAmount, 
               b.adjustmentHistory 
        FROM Budget b 
        JOIN Department d ON b.departmentID = d.departmentID;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching budget data:", err);
            return res.status(500).send("Error fetching budget data.");
        }

        if (results.length === 0) {
            return res.send("No budget data available.");
        }


        res.render('monitorbudget', { budgetData: results });

    });
});

//adjustbudget ejs
app.get('/adjust-budget', (req, res) => {
    const { user_id } = req.query;

    // Validate if the user belongs to the Finance Team
    const financeQuery = `
        SELECT finance_id FROM FinanceTeam WHERE user_id = ?;
    `;

    connection.query(financeQuery, [user_id], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error validating finance user:", err);
            return res.status(403).send("Unauthorized or invalid user.");
        }

        // Fetch departments and budgets
        const fetchDepartmentsQuery = `
            SELECT d.departmentID, d.dept_name, b.allocatedAmount, b.spentAmount, b.remainingAmount
            FROM Department d
            LEFT JOIN Budget b ON d.departmentID = b.departmentID;
        `;

        connection.query(fetchDepartmentsQuery, (err, departments) => {
            if (err) {
                console.error("Error fetching departments:", err);
                return res.status(500).send("Error fetching department budgets.");
            }


            res.render('adjustBudget', { departments, user_id });
        });
    });
});

//edit budget.ejs
app.get('/edit-budget', (req, res) => {
    const { departmentID, user_id } = req.query;

    // Fetch department budget details
    const fetchBudgetQuery = `
        SELECT d.dept_name, b.allocatedAmount, b.adjustmentHistory
        FROM Department d
        LEFT JOIN Budget b ON d.departmentID = b.departmentID
        WHERE d.departmentID = ?;
    `;

    connection.query(fetchBudgetQuery, [departmentID], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error fetching department budget:", err);
            return res.status(404).send("Department budget not found.");
        }

        const department = results[0];

        res.render('editBudget', { department, departmentID, user_id });

    });
});

app.post('/update-budget', (req, res) => {
    const { departmentID, allocatedAmount, adjustmentNote, user_id } = req.body;

    // Check if the user belongs to the Finance Team
    const financeQuery = `
        SELECT finance_id FROM FinanceTeam WHERE user_id = ?;
    `;

    connection.query(financeQuery, [user_id], (err, results) => {
        if (err || results.length === 0) {
            console.error("Unauthorized access attempt:", err);
            return res.status(403).send("Unauthorized access.");
        }

        // Logging the values being used in the query
        console.log("Updating budget for departmentID:", departmentID);
        console.log("New Allocated Amount:", allocatedAmount);
        console.log("Adjustment Note:", adjustmentNote);

        // Reset `spentAmount` and update `allocatedAmount`
        const updateBudgetQuery = `
            UPDATE Budget 
            SET 
                allocatedAmount = ?, 
                spentAmount = 0, 
                adjustmentHistory = CONCAT(IFNULL(adjustmentHistory, ''), ?)
            WHERE departmentID = ?;
        `;

        const historyEntry = `
            Updated to ${allocatedAmount} on ${new Date().toISOString().split('T')[0]}: ${adjustmentNote || 'No note'}\n`;

        // Execute the query
        connection.query(updateBudgetQuery, [allocatedAmount, historyEntry, departmentID], (err, results) => {
            if (err) {
                console.error("Error executing updateBudgetQuery:", err);
                return res.status(500).send("Error updating budget in the database.");
            }

            console.log("Budget updated successfully for department:", departmentID);

            // Fetch the updated budget and show the result
            const fetchUpdatedBudgetQuery = `
                SELECT d.dept_name, b.allocatedAmount, b.spentAmount, b.remainingAmount, b.adjustmentHistory
                FROM Department d
                LEFT JOIN Budget b ON d.departmentID = b.departmentID
                WHERE d.departmentID = ?;
            `;
            
            connection.query(fetchUpdatedBudgetQuery, [departmentID], (err, results) => {
                if (err) {
                    console.error("Error fetching updated budget:", err);
                    return res.status(500).send("Error fetching updated budget details.");
                }

                const updatedBudget = results[0];

                

                res.render('updatebudget', {  updatedBudget, user_id });

            });
        });
    });
});

// aka financereport ejs
app.get('/generate-reports', (req, res) => {
    const query = `
        SELECT d.dept_name, 
               v.vendor_name, 
               SUM(po.totalCost) AS totalSpending 
        FROM PurchaseOrder po 
        JOIN Department d ON po.departmentID = d.departmentID 
        JOIN Vendor v ON po.vendorID = v.vendorID 
        GROUP BY d.departmentID, v.vendorID;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error generating reports:", err);
            return res.status(500).send("Error generating financial reports.");
        }

       

        res.render('financeReport', { reports: results });

    });
});


// CONTRACT FUNCTIONS ########clear
// Route to manage contracts
//manageContracts.ejs
app.get('/manage-contracts', (req, res) => {
    const user_id = req.query.user_id;

    // Step 1: Find the team_id from ContractManagementTeam using user_id
    const teamQuery = 'SELECT team_id FROM ContractManagementTeam WHERE user_id = ?';
    connection.query(teamQuery, [user_id], (err, teamResults) => {
        if (err) {
            console.error("Error fetching team ID:", err);
            res.status(500).send('Error fetching team ID');
            return;
        }

        if (teamResults.length === 0) {
            res.send('No team found for the specified user.');
            return;
        }

        const assignedTeamID = teamResults[0].team_id; // Get the team_id

        // Step 2: Fetch contracts assigned to this team_id
        const contractQuery = 'SELECT * FROM Contract WHERE assignedTeamID = ?';
        connection.query(contractQuery, [assignedTeamID], (err, contractResults) => {
            if (err) {
                console.error("Error fetching contracts:", err);
                res.status(500).send('Error fetching contracts');
                return;
            }

            if (contractResults.length === 0) {
                res.send('No contracts found for the assigned team.');
                return;
            }

            res.render('manageContracts', { contracts: contractResults, user_id });
       
        });
    });
});


//updateContract.ejs
app.get('/update-contract', (req, res) => {
    const contract_id = req.query.contract_id;
    const sql = 'SELECT * FROM Contract WHERE contractID = ?';
    connection.query(sql, [contract_id], (err, results) => {
        if (err) {
            res.status(500).send('Error fetching contract details');
            return;
        }
        const contract = results[0];
        res.render('updateContract', { contract });
    });
});

app.post('/update-contract', (req, res) => {
    const { contract_id, startDate, endDate, assignedTeamID, vendorID } = req.body;
    const sql = 'UPDATE Contract SET startDate = ?, endDate = ?, assignedTeamID = ?, vendorID = ? WHERE contractID = ?';
    connection.query(sql, [startDate, endDate, assignedTeamID, vendorID, contract_id], (err, result) => {
        if (err) {
            res.status(500).send('Error updating contract');
            return;
        }

        // After update, send a notification
        const notificationSql = 'INSERT INTO Notifications (userID, contractID, notificationType, notif_date, notif_status) VALUES (?, ?, ?, CURDATE(), "Sent")';
        connection.query(notificationSql, [req.body.user_id, contract_id, 'Contract Updated'], (err) => {
            if (err) {
                console.error('Error sending notification:', err);
            }
        });

        res.send('Contract updated successfully');
    });
});

// Route to create a new contract and assign it to a vendor
// createContract.ejs
app.get('/create-contract', (req, res) => {
    const user_id = req.query.user_id;
    
    // Get available team options for the 'assignedTeamID'
    const teamSql = 'SELECT team_id, user_id FROM ContractManagementTeam';
    connection.query(teamSql, (err, teams) => {
        if (err) {
            res.status(500).send('Error fetching teams');
            return;
        }
        
        // Get available vendors for the 'vendorID'
        const vendorSql = 'SELECT vendorID, vendor_name FROM Vendor';
        connection.query(vendorSql, (err, vendors) => {
            if (err) {
                res.status(500).send('Error fetching vendors');
                return;
            }

            res.render('createContract', { user_id, vendors, teams });
        });
    });
});

// Route to handle contract creation and assignment
app.post('/create-contract', (req, res) => {
    const { vendorID, user_id, startDate, endDate, renewalDate, contractStatus, approvalStatus, assignedTeamID } = req.body;

    // Check if all required fields are present
    if (!vendorID || !user_id || !startDate || !endDate || !contractStatus || !approvalStatus || !assignedTeamID) {
        res.status(400).send('Missing required fields');
        return;
    }

    // Insert the new contract into the Contract table
    const sql = `
        INSERT INTO Contract (vendorID, userID, startDate, endDate, renewalDate, contractStatus, approvalStatus, assignedTeamID)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    connection.query(sql, [vendorID, user_id, startDate, endDate, renewalDate, contractStatus, approvalStatus, assignedTeamID], (err, result) => {
        if (err) {
            console.error('Error executing SQL:', err);  // Log the error for better debugging
            res.status(500).send('Error creating contract');
            return;
        }

        // Send a notification about the contract creation
        const notificationSql = 'INSERT INTO Notifications (userID, contractID, notificationType, notif_date, notif_status) VALUES (?, ?, ?, CURDATE(), "Sent")';
        connection.query(notificationSql, [user_id, result.insertId, 'Contract Created'], (err) => {
            if (err) {
                console.error('Error sending notification:', err);
            }
        });

        res.send('Contract created and assigned successfully');
    });
});


// this is for vendor
// Route to view all contract details/history
app.get('/view-contract-history', (req, res) => {
    // Query to fetch all contracts
    const sql = `
        SELECT contractID, startDate, endDate, renewalDate
        FROM Contract;
    `;
    
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching contract history:', err);
            res.status(500).send('Error fetching contract history');
            return;
        }

        // If no contracts are found
        if (results.length === 0) {
            return res.send('<h3>No contracts found.</h3>');
        }

        res.render('viewContractHistory', { contracts: results });
        
    });
});


// #### audits and notifcations 
// Check for expiring contracts and send notifications
app.get('/audit-vendors', (req, res) => {
    const badVendorsQuery = `
        SELECT vendorID, vendor_name, address, contactPerson, contactNumber, rating, complianceStatus
        FROM Vendor
        WHERE rating < 4.0 OR complianceStatus = FALSE;
    `;

    const goodVendorsQuery = `
        SELECT vendorID, vendor_name, address, contactPerson, contactNumber, rating, complianceStatus
        FROM Vendor
        WHERE rating >= 4.0 AND complianceStatus = TRUE;
    `;

    connection.query(badVendorsQuery, (err, badVendors) => {
        if (err) {
            console.error("Error fetching bad vendors:", err);
            return res.status(500).send("Error fetching bad vendors.");
        }

        connection.query(goodVendorsQuery, (err, goodVendors) => {
            if (err) {
                console.error("Error fetching good vendors:", err);
                return res.status(500).send("Error fetching good vendors.");
            }

            // // Render the compliance audit page dynamically with embedded notification form
            // res.send(`
            //     <html>
            //         <head>
            //             <title>Compliance and Auditing</title>
            //         </head>
            //         <body>
            //             <h1>Compliance and Auditing</h1>

            //             <h2>Bad Vendors</h2>
            //             <ul>
            //                 ${badVendors.map(vendor => `
            //                     <li>
            //                         <strong>Name:</strong> ${vendor.vendor_name}<br>
            //                         <strong>Address:</strong> ${vendor.address}<br>
            //                         <strong>Contact Person:</strong> ${vendor.contactPerson}<br>
            //                         <strong>Contact Number:</strong> ${vendor.contactNumber}<br>
            //                         <strong>Rating:</strong> ${vendor.rating}<br>
            //                         <strong>Compliance Status:</strong> ${vendor.complianceStatus ? 'Compliant' : 'Non-Compliant'}<br>

            //                         <!-- Notification Form -->
            //                         <form action="/send-notification" method="POST">
            //                             <input type="hidden" name="vendor_id" value="${vendor.vendorID}">
            //                             <label for="message-${vendor.vendorID}">Notification Message:</label><br>
            //                             <textarea id="message-${vendor.vendorID}" name="message" rows="2" cols="30" placeholder="Enter your message here"></textarea><br>
            //                             <button type="submit">Send Notification</button>
            //                         </form>
            //                     </li>
            //                 `).join('')}
            //             </ul>

            //             <h2>Good Vendors</h2>
            //             <ul>
            //                 ${goodVendors.map(vendor => `
            //                     <li>
            //                         <strong>Name:</strong> ${vendor.vendor_name}<br>
            //                         <strong>Address:</strong> ${vendor.address}<br>
            //                         <strong>Contact Person:</strong> ${vendor.contactPerson}<br>
            //                         <strong>Contact Number:</strong> ${vendor.contactNumber}<br>
            //                         <strong>Rating:</strong> ${vendor.rating}<br>
            //                         <strong>Compliance Status:</strong> ${vendor.complianceStatus ? 'Compliant' : 'Non-Compliant'}<br>
            //                     </li>
            //                 `).join('')}
            //             </ul>

            //             <a href="/dashboard">Back to Dashboard</a>
            //         </body>
            //     </html>
            // `);

            res.render('audit', {
                badVendors: badVendors,
                goodVendors: goodVendors
            });

        });
    });
});


app.post('/send-notification', (req, res) => {
    const { vendor_id, message } = req.body;

    const insertNotificationQuery = `
        INSERT INTO VendorNotifications (vendor_id, message)
        VALUES (?, ?);
    `;

    connection.query(insertNotificationQuery, [vendor_id, message], (err) => {
        if (err) {
            console.error("Error inserting notification:", err);
            return res.status(500).send("Error sending notification.");
        }

        res.send("Notification successfully recorded in the database!");
    });
});

// Route to delete contract
app.post('/delete-contract', (req, res) => {
    const contract_id = req.body.contract_id;
    const sql = 'DELETE FROM Contract WHERE contractID = ?';
    connection.query(sql, [contract_id], (err, result) => {
        if (err) {
            res.status(500).send('Error deleting contract');
            return;
        }
        res.send('Contract deleted successfully');
    });
});




// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
