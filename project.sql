
CREATE DATABASE vmc;
USE vmc;

-- User table for authentication
CREATE TABLE User (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    user_password VARCHAR(255) NOT NULL,
    user_type ENUM('VendorManagementTeam', 'ProcurementManager', 'FinanceTeam', 'ContractManagementTeam', 'Vendor') NOT NULL
);

-- Vendor Management Team Table
CREATE TABLE VendorManagementTeam (
    team_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    team_name VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Procurement Manager Table
CREATE TABLE ProcurementManager (
    manager_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    department VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Finance Team Table
CREATE TABLE FinanceTeam (
    finance_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    budget_assigned DECIMAL(15, 2),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Contract Management Team Table
CREATE TABLE ContractManagementTeam (
    team_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    assigned_contracts TEXT,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Vendor Table
CREATE TABLE Vendor (
    vendorID INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    address TEXT,
    contactPerson VARCHAR(255),
    contactNumber VARCHAR(15),
    vendor_email VARCHAR(255),
    complianceStatus BOOLEAN NOT NULL,
    rating DECIMAL(3, 2) CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Department Table
CREATE TABLE Department (
    departmentID INT PRIMARY KEY AUTO_INCREMENT,
    dept_name VARCHAR(255) NOT NULL,
    managerID INT UNIQUE,
    FOREIGN KEY (managerID) REFERENCES ProcurementManager(manager_id) ON DELETE SET NULL
);

-- Budget Table
CREATE TABLE Budget (
    budgetID INT PRIMARY KEY AUTO_INCREMENT,
    departmentID INT UNIQUE,
    allocatedAmount DECIMAL(15, 2) NOT NULL,
    spentAmount DECIMAL(15, 2) DEFAULT 0.00,
    remainingAmount DECIMAL(15, 2) GENERATED ALWAYS AS (allocatedAmount - spentAmount) STORED,
    adjustmentHistory TEXT,
    FOREIGN KEY (departmentID) REFERENCES Department(departmentID) ON DELETE CASCADE
);

-- Contract Table
CREATE TABLE Contract (
    contractID INT PRIMARY KEY AUTO_INCREMENT,
    vendorID INT,
    userID INT,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    renewalDate DATE,
    contractStatus ENUM('Active', 'Expired', 'Pending Renewal'),
    approvalStatus ENUM('Approved', 'Rejected'),
    FOREIGN KEY (vendorID) REFERENCES Vendor(vendorID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES User(user_id) ON DELETE SET NULL
);

-- Notifications Table
CREATE TABLE Notifications (
    notificationID INT PRIMARY KEY AUTO_INCREMENT,
    userID INT,
    contractID INT,
    notificationType VARCHAR(100),
    notif_date DATE NOT NULL,
    notif_status ENUM('Sent', 'Read', 'Pending'),
    FOREIGN KEY (userID) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (contractID) REFERENCES Contract(contractID) ON DELETE CASCADE
);

CREATE TABLE VendorNotifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Sent', 'Pending') DEFAULT 'Pending',
    FOREIGN KEY (vendor_id) REFERENCES Vendor(vendorID)) ;

-- Purchase Order Table
CREATE TABLE PurchaseOrder (
    orderID INT PRIMARY KEY AUTO_INCREMENT,
    itemDetails TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    costPerUnit DECIMAL(15, 2) NOT NULL,
    totalCost DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * costPerUnit) STORED,
    vendorID INT,
    departmentID INT,
    budgetValidationStatus BOOLEAN NOT NULL,
    order_status ENUM('Pending', 'Approved', 'Rejected'),
    orderDate DATE NOT NULL,
    FOREIGN KEY (vendorID) REFERENCES Vendor(vendorID) ON DELETE CASCADE,
    FOREIGN KEY (departmentID) REFERENCES Department(departmentID) ON DELETE CASCADE
);

-- Performance Evaluation Table
CREATE TABLE PerformanceEvaluation (
    evaluationID INT PRIMARY KEY AUTO_INCREMENT,
    vendorID INT,
    userID INT,
    team_id INT,  -- Link to the Vendor Management Team
    feedback TEXT,
    rating DECIMAL(3, 2) CHECK (rating BETWEEN 1 AND 5),
    evaluationDate DATE NOT NULL,
    FOREIGN KEY (vendorID) REFERENCES Vendor(vendorID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES VendorManagementTeam(team_id) ON DELETE SET NULL
);

-- Junction Table for Many-to-Many User and Performance Evaluation
CREATE TABLE User_PerformanceEvaluation (
    userID INT,
    evaluationID INT,
    PRIMARY KEY (userID, evaluationID),
    FOREIGN KEY (userID) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (evaluationID) REFERENCES PerformanceEvaluation(evaluationID) ON DELETE CASCADE
);







-- triggers-

DELIMITER //
CREATE TRIGGER validate_budget_before_insert
BEFORE INSERT ON PurchaseOrder
FOR EACH ROW
BEGIN
    DECLARE remaining_budget DECIMAL(15, 2);
    
    -- Get the remaining budget of the associated department
    SELECT remainingAmount INTO remaining_budget
    FROM Budget
    WHERE departmentID = NEW.departmentID;

    -- Check if the department has sufficient budget
    IF remaining_budget < NEW.totalCost THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Insufficient budget for this purchase order';
    END IF;
END //
DELIMITER ;



DELIMITER //
CREATE TRIGGER update_renewal_date_after_update
AFTER UPDATE ON Contract
FOR EACH ROW
BEGIN
    -- Update renewalDate when the contract status transitions from Expired to Pending Renewal
    IF NEW.contractStatus = 'Pending Renewal' AND OLD.contractStatus = 'Expired' THEN
        UPDATE Contract
        SET renewalDate = DATE_ADD(NEW.endDate, INTERVAL 1 YEAR)
        WHERE contractID = NEW.contractID;
    END IF;
END //
DELIMITER ;



DELIMITER //
CREATE PROCEDURE insert_performance_evaluation(
    IN p_vendorID INT,
    IN p_userID INT,
    IN p_team_id INT,
    IN p_feedback TEXT,
    IN p_rating DECIMAL(3,2)
)
BEGIN
    -- Verify the user belongs to the VendorManagementTeam
    DECLARE role_check INT;
    SELECT COUNT(*) INTO role_check
    FROM VendorManagementTeam
    WHERE user_id = p_userID AND team_id = p_team_id;

    IF role_check = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'User is not part of the specified Vendor Management Team';
    END IF;

    -- Ensure the rating is valid
    IF p_rating < 1 OR p_rating > 5 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Rating must be between 1 and 5';
    END IF;

    -- Insert performance evaluation
    INSERT INTO PerformanceEvaluation (vendorID, userID, team_id, feedback, rating, evaluationDate)
    VALUES (p_vendorID, p_userID, p_team_id, p_feedback, p_rating, CURDATE());
END //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE add_user_with_role(
    IN p_user_email VARCHAR(255),
    IN p_user_password VARCHAR(255),
    IN p_user_type VARCHAR(50),
    IN p_additional_info VARCHAR(255) -- Info for role-specific fields
)
BEGIN
    DECLARE new_user_id INT;

    -- Add the user to the User table
    INSERT INTO User (user_email, user_password, user_type)
    VALUES (p_user_email, p_user_password, p_user_type);

    -- Retrieve the auto-generated user_id
    SET new_user_id = LAST_INSERT_ID();

    -- Assign roles based on the input parameter
    IF p_user_type = 'Vendor' THEN
        INSERT INTO Vendor (user_id, vendor_name, complianceStatus, rating)
        VALUES (new_user_id, p_additional_info, TRUE, 4.0);

    ELSEIF p_user_type = 'ProcurementManager' THEN
        INSERT INTO ProcurementManager (user_id, department)
        VALUES (new_user_id, p_additional_info);

    ELSEIF p_user_type = 'FinanceTeam' THEN
        INSERT INTO FinanceTeam (user_id, budget_assigned)
        VALUES (new_user_id, p_additional_info);

    ELSEIF p_user_type = 'ContractManagementTeam' THEN
        INSERT INTO ContractManagementTeam (user_id, assigned_contracts)
        VALUES (new_user_id, p_additional_info);

    ELSE
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Invalid user type specified.';
    END IF;
END //
DELIMITER ;




DELIMITER //
CREATE TRIGGER validate_contract_status_before_insert
BEFORE INSERT ON Contract
FOR EACH ROW
BEGIN
    -- Set contract status based on the end date
    IF NEW.endDate < CURDATE() THEN
        SET NEW.contractStatus = 'Expired';
    ELSE
        SET NEW.contractStatus = 'Active';
    END IF;
END //
DELIMITER ;



-- insertion--

INSERT INTO User (user_email, user_password, user_type)
VALUES 
('vendor1@example.com', 'password123', 'Vendor'),
('vendor2@example.com', 'password456', 'Vendor'),
('finance1@example.com', 'securepass', 'FinanceTeam'),
('manager1@example.com', 'managerpass', 'ProcurementManager'),
('vendor_mgmt@example.com', 'teamlead', 'VendorManagementTeam');

INSERT INTO User (user_email, user_password, user_type)
VALUES
('cmt_lead1@example.com', 'password1', 'ContractManagementTeam'),
('cmt_lead2@example.com', 'password2', 'ContractManagementTeam');

INSERT INTO ContractManagementTeam (user_id, assigned_contracts)
VALUES
(1, 'Contract-001, Contract-002'),
(2, 'Contract-003, Contract-004');


INSERT INTO VendorManagementTeam (user_id, team_name)
VALUES
(5, 'Vendor Quality Assurance Team');

INSERT INTO ProcurementManager (user_id, department)
VALUES
(4, 'Electronics Procurement');

INSERT INTO FinanceTeam (user_id, budget_assigned)
VALUES
(3, 500000.00);

INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
VALUES
(1, 'Tech Supplies Co.', '123 Tech Street, Silicon City', 'Alice Johnson', '123-456-7890', 'contact@techsupplies.com', TRUE, 4.8),
(2, 'Office Essentials Inc.', '456 Office Blvd, Paper Town', 'Bob Brown', '234-567-8901', 'contact@officeessentials.com', TRUE, 4.5);


INSERT INTO Department (dept_name, managerID)
VALUES
('Electronics', 1),
('Office Supplies', NULL);


INSERT INTO Budget (departmentID, allocatedAmount, spentAmount, adjustmentHistory)
VALUES
(1, 200000.00, 50000.00, 'Initial allocation of 200,000.'),
(2, 150000.00, 30000.00, 'Initial allocation of 150,000.');

INSERT INTO Contract (vendorID, userID, startDate, endDate, renewalDate, contractStatus, approvalStatus)
VALUES
(1, 5, '2024-01-01', '2024-12-31', NULL, 'Active', 'Approved'),
(2, 5, '2023-01-01', '2023-12-31', NULL, 'Expired', 'Approved');


INSERT INTO Notifications (userID, contractID, notificationType, notif_date, notif_status)
VALUES
(1, 1, 'Contract Renewal Reminder', '2024-11-15', 'Sent'),
(2, 2, 'Compliance Warning', '2024-11-20', 'Pending');


INSERT INTO PurchaseOrder (itemDetails, quantity, costPerUnit, vendorID, departmentID, budgetValidationStatus, order_status, orderDate)
VALUES
('Laptops - Model X', 10, 1000.00, 1, 1, TRUE, 'Approved', '2024-11-10'),
('Printer Paper - A4', 50, 10.00, 2, 2, TRUE, 'Pending', '2024-11-15');

INSERT INTO PerformanceEvaluation (vendorID, userID, team_id, feedback, rating, evaluationDate)
VALUES
(1, 5, 1, 'Great delivery performance and excellent compliance.', 4.9, '2024-11-12'),
(2, 5, 1, 'Consistent quality but delayed shipments.', 4.5, '2024-11-14');

INSERT INTO User_PerformanceEvaluation (userID, evaluationID)
VALUES
(5, 1),
(5, 2);

SELECT u.user_id, u.user_email, v.vendor_name, v.complianceStatus, v.rating
FROM User u
INNER JOIN Vendor v ON u.user_id = v.user_id;


SELECT u.user_id, u.user_email, vmt.team_name
FROM User u
INNER JOIN VendorManagementTeam vmt ON u.user_id = vmt.user_id;


SELECT u.user_id, u.user_email, pm.department
FROM User u
INNER JOIN ProcurementManager pm ON u.user_id = pm.user_id;

SELECT u.user_id, u.user_email, ft.budget_assigned
FROM User u
INNER JOIN FinanceTeam ft ON u.user_id = ft.user_id;

SELECT u.user_id, u.user_email, cmt.assigned_contracts
FROM User u
INNER JOIN ContractManagementTeam cmt ON u.user_id = cmt.user_id;

SELECT 'Vendor' AS Role, u.user_id, u.user_email
FROM User u
INNER JOIN Vendor v ON u.user_id = v.user_id
UNION ALL
SELECT 'VendorManagementTeam' AS Role, u.user_id, u.user_email
FROM User u
INNER JOIN VendorManagementTeam vmt ON u.user_id = vmt.user_id
UNION ALL
SELECT 'ProcurementManager' AS Role, u.user_id, u.user_email
FROM User u
INNER JOIN ProcurementManager pm ON u.user_id = pm.user_id
UNION ALL
SELECT 'FinanceTeam' AS Role, u.user_id, u.user_email
FROM User u
INNER JOIN FinanceTeam ft ON u.user_id = ft.user_id
UNION ALL
SELECT 'ContractManagementTeam' AS Role, u.user_id, u.user_email
FROM User u
INNER JOIN ContractManagementTeam cmt ON u.user_id = cmt.user_id;


-- trigger testing--
INSERT INTO User (user_email, user_password, user_type)
VALUES ('vmt_member@example.com', 'password123', 'VendorManagementTeam');

INSERT INTO VendorManagementTeam (user_id, team_name)
VALUES (LAST_INSERT_ID(), 'Quality Team');


CALL insert_performance_evaluation(1, 5, 1, 'Excellent vendor performance', 4.5);


CALL insert_performance_evaluation(1, 8, 2, 'Average performance', 5.0);


-- Insert a user record in the User table
INSERT INTO User (user_email, user_password, user_type) 
VALUES ('greenfarms@example.com', 'password123', 'Vendor');


-- Insert the vendor record, ensuring the user_id exists
INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
VALUES (24, 'Green Farms', 'Farmhouse 10, Village Road, Lahore, Pakistan', 'Ahmed Ali', '03219876543', 'greenfarms@example.com', true, 0.0);


INSERT INTO User (user_email, user_password, user_type) 
VALUES ('green@example.com', 'passwo23', 'Vendor');


INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
VALUES (25, 'Green Farms', 'Farmhouse 10, Village Road, Lahore, Pakistan', 'Ahmed Ali', '03219876543', 'green@example.com', true, 0.0);


ALTER TABLE Vendor
DROP CHECK vendor_chk_1;

ALTER TABLE Vendor
ADD CONSTRAINT vendor_chk_1
CHECK (rating BETWEEN 0 AND 5 OR rating IS NULL);

-- Drop the existing CHECK constraint (adjust for your actual constraint name)
ALTER TABLE Vendor DROP CHECK vendor_chk_2;

-- If you want to allow ratings from 0.0 to 5.0
ALTER TABLE Vendor ADD CONSTRAINT vendor_chk_2 CHECK (rating >= 0.0 AND rating <= 5.0);

-- Inserting vendor data with a NULL rating
INSERT INTO Vendor (user_id, vendor_name, address, contactPerson, contactNumber, vendor_email, complianceStatus, rating)
VALUES
(3, 'Green Farms', 'Farmhouse 10, Village Road, Lahore, Pakistan', 'Ahmed Ali', '03219876543', 'greenfarms@example.com', true, 0.0);

select* from vendor;


UPDATE Budget 
SET allocatedAmount = 6900, 
    spentAmount = 0, 
    adjustmentHistory = CONCAT(IFNULL(adjustmentHistory, ''), 2)
WHERE departmentID = 1;

UPDATE Budget 
SET 
    allocatedAmount = 10000, 
    spentAmount = 0, 
    adjustmentHistory = CONCAT(IFNULL(adjustmentHistory, ''), 2)
WHERE departmentID = 1;


-- Insert data into the User table for ContractManagementTeam member
INSERT INTO User (user_email, user_password, user_type)
VALUES 
    ('contract_manager@example.com', 'securepassword123', 'ContractManagementTeam');
    
    
    -- Insert data into the ContractManagementTeam table using the inserted user_id
INSERT INTO ContractManagementTeam (user_id, assigned_contracts)
VALUES 
    (LAST_INSERT_ID(), 'Contract A, Contract B, Contract C');


-- Step 1: Add the assignedTeamID column to Contract table
ALTER TABLE Contract
ADD COLUMN assignedTeamID INT;

-- Step 2: Add the foreign key constraint
ALTER TABLE Contract
ADD CONSTRAINT fk_assigned_team
FOREIGN KEY (assignedTeamID) REFERENCES ContractManagementTeam(team_id)
ON DELETE SET NULL;

INSERT INTO Contract (vendorID, userID, startDate, endDate, renewalDate, contractStatus, approvalStatus, assignedTeamID)
VALUES (6, 3, '2024-11-01', '2025-11-01', '2025-10-01', 'Active', 'Approved', 3);

select* from user;

