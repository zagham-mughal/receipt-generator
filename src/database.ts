import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database types
export interface Company {
  id: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  country: string;
  designId: number;
  createdAt: string;
}

export interface Store {
  id: number;
  companyId: number;
  storeCode: string;
  address: string;
  cityState: string;
  phone: string;
  items: string;
  createdAt: string;
}

// Initialize database
const dbPath = path.join(__dirname, '../data/companies.db');
const dbDir = path.dirname(dbPath);

// Create data directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('📁 Created data directory');
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
export function initializeDatabase(): void {
  // Drop existing tables to recreate
  db.exec(`DROP TABLE IF EXISTS stores`);
  db.exec(`DROP TABLE IF EXISTS companies`);
  
  // Create companies table with country field
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      country TEXT NOT NULL,
      designId INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create stores table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER NOT NULL,
      storeCode TEXT NOT NULL,
      address TEXT NOT NULL,
      cityState TEXT NOT NULL,
      phone TEXT NOT NULL,
      items TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Database initialized');
}

// Seed dummy companies
export function seedDummyCompanies(): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
  
  if (count.count > 0) {
    console.log('📊 Database already has companies');
    return;
  }

  const dummyCompanies = [
    // USA Gas Stations & Travel Centers
    { name: 'ONE 9 Fuel Network', address: '4455 King Street, Cocoa, FL 32926', email: 'support@one9fuel.com', phone: '(321) 639-0346', country: 'United States of America', designId: 0 },
    { name: 'Pilot Travel Centers', address: '5508 Lonas Drive, Knoxville, TN 37909', email: 'contact@pilotflyingj.com', phone: '(865) 555-0222', country: 'United States of America', designId: 1 },
    { name: 'Flying J', address: '1637 Pettit Road, Ft.Erie, ON', email: 'info@flyingj.com', phone: '905-991-1800', country: 'United States of America', designId: 2 },
    { name: "Love's Travel Stops", address: '10601 N Pennsylvania Avenue, Oklahoma City, OK 73120', email: 'service@loves.com', phone: '(405) 555-0444', country: 'United States of America', designId: 3 },
    { name: 'TravelCenters of America', address: '24601 Center Ridge Road, Westlake, OH 44145', email: 'info@ta-petro.com', phone: '(440) 555-0555', country: 'United States of America', designId: 4 },
    
    // Canadian Companies
    { name: 'Flying J', address: '1637 Pettit Road, Ft.Erie, ON L2A 1A1', email: 'info@flyingj.ca', phone: '(905) 991-1800', country: 'Canada', designId: 2 },
    { name: 'Husky', address: '456 Trans-Canada Hwy, Calgary, AB T2P 0A1', email: 'service@husky.ca', phone: '(403) 555-0803', country: 'Canada', designId: 2 },
    { name: 'Petro-Canada', address: '789 Trans-Canada Hwy, Calgary, AB T2P 0A1', email: 'service@petro-canada.ca', phone: '(403) 555-0803', country: 'Canada', designId: 2 },
    { name: 'Pearson Mart Esso', address: '321 Airport Road, Toronto, ON M5H 1A1', email: 'info@pearsonmart.ca', phone: '(416) 555-0601', country: 'Canada', designId: 2 },
    { name: 'BVD Petroleum Vancouver', address: '654 Main Street, Vancouver, BC V6B 1A1', email: 'contact@bvdpetroleum.ca', phone: '(604) 555-0702', country: 'Canada', designId: 2 },
    { name: 'BVD Petroleum', address: '495 York Road, Niagara, ON L0S 1J0', email: 'service@bvdpetroleum.ca', phone: '(905) 684-1079', country: 'Canada', designId: 2 }
  ];

  const insert = db.prepare(`
    INSERT INTO companies (name, address, email, phone, country, designId)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((companies) => {
    for (const company of companies) {
      insert.run(company.name, company.address, company.email, company.phone, company.country, company.designId);
    }
  });

  insertMany(dummyCompanies);
  console.log(`✅ Seeded ${dummyCompanies.length} companies (USA: 5, Canada: 5)`);
}

// Seed Love's Travel Stops stores from CSV data
export function seedLovesStores(): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM stores').get() as { count: number };
  
  if (count.count > 0) {
    console.log('📊 Database already has stores');
    return;
  }

  // Get Love's Travel Stops company ID
  const lovesCompany = db.prepare('SELECT id FROM companies WHERE name LIKE ?').get("%Love%") as { id: number } | undefined;
  
  if (!lovesCompany) {
    console.log('⚠️  Love\'s Travel Stops company not found, skipping store seeding');
    return;
  }

  const lovesStores = [
    { storeCode: 'Store 833', address: '6201 Shortman Road', cityState: 'Ripley, NY 14775', phone: '(716) 736-2023', items: 'DIESEL' },
    { storeCode: 'Store 772', address: '7748 Route 53', cityState: 'Bath, NY 14810', phone: '(607) 622-1150', items: 'CASH ADVANCE' },
    { storeCode: 'Store 820', address: '1262 Route 414', cityState: 'Waterloo, NY 13165', phone: '(315) 835-7244', items: 'DEF' },
    { storeCode: 'Store 403', address: '2 Industrial Park Dr', cityState: 'Binghamton, NY 13904', phone: '(607) 651-9153', items: 'REEFER' },
    { storeCode: 'Store 870', address: '23425 State Route 12', cityState: 'Watertown, NY 13601', phone: '(315) 221-7018', items: '' },
    { storeCode: 'Store 611', address: '12845 Route 22', cityState: 'Canaan, NY 12029', phone: '(518) 781-4040', items: '' },
    { storeCode: 'Store 731', address: '1011 New Castle Road', cityState: 'Slippery Rock, PA 16057', phone: '(724) 530-2965', items: '' },
    { storeCode: 'Store 829', address: '1373 Route 28', cityState: 'Brookville, PA 15825', phone: '(814) 646-6014', items: '' },
    { storeCode: 'Store 407', address: '1165 Harrisburg Pike', cityState: 'Carlisle, PA 17013', phone: '(717) 240-0055', items: '' },
    { storeCode: 'Store 535', address: '3555 Vine St', cityState: 'Londonderry, PA 17057', phone: '(717) 948-1840', items: '' },
    { storeCode: 'Store 924', address: '7709 Linglestown Rd', cityState: 'Harrisburg, PA 17112', phone: '(717) 526-4840', items: '' },
    { storeCode: 'Store 366', address: '22 Old Forge Rd', cityState: 'Jonestown , PA 17038', phone: '(717) 861-7390', items: '' },
    { storeCode: 'Store 324', address: '440 W. 3rd', cityState: 'Mifflinville , PA 18631', phone: '(570) 752-9013', items: '' },
    { storeCode: 'Store 358', address: '3700 Mountain Road', cityState: 'Hamburg, PA 19526', phone: '(610) 488-8840', items: '' },
    { storeCode: 'Store 317', address: '770 Moores Ferry Rd', cityState: 'Skippers, VA 23879', phone: '(434) 336-0203', items: '' },
    { storeCode: 'Store 435', address: '23845 Rogers Clark Blvd', cityState: 'Ruther Glen, VA 22546', phone: '(804) 448-0102', items: '' },
    { storeCode: 'Store 574', address: '5275 N Fork Rd', cityState: 'Elliston, VA 24087', phone: '(540) 404-6700', items: '' },
    { storeCode: 'Store 707', address: '9104 Winterberry Ave', cityState: 'Covington, VA 24426', phone: '(540) 862-9044', items: '' },
    { storeCode: 'Store 706', address: '3499 Lee Jackson Highway', cityState: 'Staunton, VA 24401', phone: '(540) 337-1070', items: '' },
    { storeCode: 'Store 378', address: '3875 Charleston Rd', cityState: 'Ripley, WV 25271', phone: '(304) 372-5250', items: '' },
    { storeCode: 'Store 412', address: '3948 Hodges Chapel Rd', cityState: 'Dunn, NC 28334', phone: '(910) 892-7230', items: '' },
    { storeCode: 'Store 930', address: '101 Woodard Dr', cityState: 'Kenly, NC 27542', phone: '(919) 284-1058', items: '' },
    { storeCode: 'Store 667', address: '1217 Trollingwood Hawflds Rd', cityState: 'Mebane, NC 27302', phone: '(919) 563-1814', items: '' },
    { storeCode: 'Store 925', address: '940 Jimmie Kerr Rd', cityState: 'Haw River, NC 27258', phone: '(336) 578-7950', items: '' },
    { storeCode: 'Store 741', address: '2105 Barnes Street', cityState: 'Reidsville, NC 27320', phone: '(336) 342-1656', items: '' },
    { storeCode: 'Store 883', address: '2257 Shore Rd', cityState: 'Rural Hall, NC 27045', phone: '(336) 642-6022', items: '' },
    { storeCode: 'Store 740', address: '409 Yemassee Hwy', cityState: 'Yemassee, SC 29945', phone: '(843) 589-2010', items: '' },
    { storeCode: 'Store 790', address: '401 Buff Blvd', cityState: 'Summerton, SC 29148', phone: '(803) 488-2000', items: '' },
    { storeCode: 'Store 371', address: '1911 Highway 34 W', cityState: 'Dillon, SC 29536', phone: '(843) 774-2255', items: '' },
    { storeCode: 'Store 847', address: '2210 Hwy 601 N', cityState: 'Pageland, SC 29728', phone: '(843) 517-5003', items: '' },
    { storeCode: 'Store 363', address: '7791 NW 47th Avenue', cityState: 'Ocala, FL 34482', phone: '(352) 368-5719', items: '' },
    { storeCode: 'Store 708', address: '2615 W C-48', cityState: 'Bushnell, FL 33513', phone: '(352) 793-1019', items: '' },
    { storeCode: 'Store 894', address: '1025 SR 206 W', cityState: 'St Augustine, FL 32086', phone: '(904) 417-9010', items: '' },
    { storeCode: 'Store 316', address: '1657 N US Highway 1', cityState: 'Ormond Beach, FL 32174', phone: '(386) 671-9585', items: '' },
    { storeCode: 'Store 228', address: '1800 Highway 559', cityState: 'Auburndale, FL 33868', phone: '(863) 984-7030', items: '' },
    { storeCode: 'Store 495', address: '17308 Park 78 Drive North', cityState: 'Fort Myers, FL 33917', phone: '(239) 731-9217', items: '' },
    { storeCode: 'Store 878', address: '7900 Adobe Road', cityState: 'Alamo, MI 49009', phone: '(269) 903-0294', items: '' },
    { storeCode: 'Store 742', address: '9790 Adams St', cityState: 'Holland, MI 49424', phone: '(616) 772-3101', items: '' },
    { storeCode: 'Store 336', address: '18720 Partello Rd', cityState: 'Marshall , MI 49068', phone: '(269) 781-9203', items: '' },
    { storeCode: 'Store 785', address: '7300 West Grand River Ave', cityState: 'Grand Ledge, MI 48837', phone: '(517) 626-7370', items: '' },
    { storeCode: 'Store 281', address: '200 Garden Acres Dr', cityState: 'Fort Worth, TX 76140', phone: '(817) 293-5118', items: '' },
    { storeCode: 'Store 294', address: '8800 S. Polk Street', cityState: 'Dallas, TX 75232', phone: '(972) 224-5970', items: '' },
    { storeCode: 'Store 852', address: '2486 US Hwy-82 W', cityState: 'New Boston, TX 75570', phone: '(903) 417-6056', items: '' },
    { storeCode: 'Store 719', address: '1610 Cotton Gin Rd', cityState: 'Troy, TX 76579', phone: '(254) 938-2579', items: '' },
    { storeCode: 'Store 946', address: '1855 N Foster Rd', cityState: 'San Antonio, TX 78244', phone: '(210) 666-9020', items: '' },
    { storeCode: 'Store 242', address: '11361 S. I-35', cityState: 'San Antonio, TX 78073', phone: '(210) 623-2329', items: '' },
    { storeCode: 'Store 935', address: '102 Logistics Dr', cityState: 'Laredo, TX 78045', phone: '(956) 725-2459', items: '' },
    { storeCode: 'Store 481', address: '7005 Highway 225', cityState: 'Deer Park, TX 77536', phone: '(281) 479-3430', items: '' },
    { storeCode: 'Store 315', address: '3940 N McCarty St', cityState: 'Houston, TX 77013', phone: '(713) 670-0235', items: '' },
    { storeCode: 'Store 606', address: '1533 E 162nd Street', cityState: 'South Holland, IL 60473', phone: '(708) 331-7365', items: '' },
    { storeCode: 'Store 920', address: '5225 W 26th Ave', cityState: 'Gary, IN 46406', phone: '(219) 844-0484', items: '' }
  ];

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(lovesCompany.id, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  insertMany(lovesStores);
  console.log(`✅ Seeded ${lovesStores.length} Love's Travel Stops stores`);
}

// Seed Flying J stores from provided data
export function seedFlyingJStores(): void {
  // Get Flying J company ID
  const flyingJCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('Flying J') as { id: number } | undefined;
  
  if (!flyingJCompany) {
    console.log('⚠️  Flying J company not found, skipping store seeding');
    return;
  }

  const flyingJStores = [
    { storeCode: 'Store 693', address: '8484 Alleghany Road', cityState: 'Corfu, NY 14036', phone: '(585) 599-4430', items: 'Truck Diesel' },
    { storeCode: 'Store 380', address: '107 Seventh North Street', cityState: 'Liverpool, NY 13088', phone: '(315) 424-0124', items: 'DEF Fuel Item' },
    { storeCode: 'Store 1317', address: '164 Riverside Drive', cityState: 'Fultonville, NY 12072', phone: '(518) 414-0591', items: 'Reefer Fuel' },
    { storeCode: 'Store 494', address: '1128 Duanesburg Road', cityState: 'Schenectady, NY 12306', phone: '(518) 356-5616', items: 'Cash Advance Item' },
    { storeCode: 'Store 394', address: '239 Route 17K', cityState: 'Newburgh, NY 12550', phone: '(845) 567-1722', items: '' },
    { storeCode: 'Store 707', address: '246 Allegheny Blvd', cityState: 'Brookville, PA 15825', phone: '(814) 849-2992', items: '' },
    { storeCode: 'Store 4563', address: '7833 Linglestown Road', cityState: 'Harrisburg, PA 17112', phone: '(717) 901-6186', items: '' },
    { storeCode: 'Store 370', address: '417 Route 315', cityState: 'Pittston, PA 18640', phone: '(570) 655-4116', items: '' },
    { storeCode: 'Store 311', address: '8035 Perry Hwy', cityState: 'Erie, PA 16509', phone: '(814) 864-8536', items: '' },
    { storeCode: 'Store 708', address: '1501 Harrisburg Pike', cityState: 'Carlisle, PA 17015', phone: '(717) 243-6659', items: '' },
    { storeCode: 'Store 348', address: '205 Wilson Road', cityState: 'Bentleyville, PA 15314', phone: '(724) 774-0811', items: '' },
    { storeCode: 'Store 752', address: '1530 Rest Church Road', cityState: 'Clear Brook, VA 22624', phone: '(540) 678-3641', items: '' },
    { storeCode: 'Store 754', address: '3249 Chapman Road', cityState: 'Wytheville, VA 24382', phone: '(276) 228-7110', items: '' },
    { storeCode: 'Store 876', address: '23866 Rogers Clark Blvd.', cityState: 'Ruther Glen, VA 22546', phone: '(804) 448-3077', items: '' },
    { storeCode: 'Store 749', address: '24279 Rogers Clark Boulevard', cityState: 'Ruther Glen, VA 22546', phone: '(804) 448-9047', items: '' },
    { storeCode: 'Store 683', address: '1800 Princeton Kenly Rd', cityState: 'Kenly, NC 27542', phone: '(919) 284-4548', items: '' },
    { storeCode: 'Store 711', address: '1011 North Mountain St', cityState: 'Blacksburg, SC 29702', phone: '(864) 839-5934', items: '' },
    { storeCode: 'Store 712', address: '5901 Fairfield Road', cityState: 'Columbia, SC 29203', phone: '(803) 735-9006', items: '' },
    { storeCode: 'Store 1068', address: '799 Jedburg Road', cityState: 'Summerville, SC 29483', phone: '(843) 851-2023', items: '' },
    { storeCode: 'Store 714', address: '2435 Mount Holly Road', cityState: 'Rock Hill, SC 29730', phone: '(803) 328-5700', items: '' },
    { storeCode: 'Store 623', address: '32670 Blue Star Hwy', cityState: 'Midway, FL 32343', phone: '(850) 574-9779', items: '' },
    { storeCode: 'Store 1096', address: '1101 Friday Road', cityState: 'Cocoa, FL 32926', phone: '(321) 433-3150', items: '' },
    { storeCode: 'Store 622', address: '100 North Kings Hwy', cityState: 'Fort Pierce, FL 34945', phone: '(772) 461-0091', items: '' },
    { storeCode: 'Store 895', address: '21055 West Road', cityState: 'Woodhaven, MI 48183', phone: '(313) 524-9985', items: '' },
    { storeCode: 'Store 668', address: '3475 E Washington Rd', cityState: 'Saginaw, MI 48601', phone: '(989) 752-6350', items: '' },
    { storeCode: 'Store 694', address: '2349 Center Road', cityState: 'Austinburg, OH 44010', phone: '(440) 275-1515', items: '' },
    { storeCode: 'Store 552', address: '3140 OH-350', cityState: 'Lebanon, OH 45036', phone: '(513) 933-0312', items: '' },
    { storeCode: 'Store 696', address: '7735 E State Rt 37', cityState: 'Sunbury, OH 43074', phone: '(740) 965-9835', items: '' },
    { storeCode: 'Store 768', address: '1300 N. Corrington Avenue', cityState: 'Kansas City, MO 64120', phone: '(816) 483-7600', items: '' },
    { storeCode: 'Store 1061', address: '4939 West Chestnut Expressway', cityState: 'Springfield, MO 65802', phone: '(417) 864-4175', items: '' },
    { storeCode: 'Store 671', address: '703 State Hwy 80', cityState: 'Matthews, MO 63867', phone: '(573) 472-3336', items: '' },
    { storeCode: 'Store 605', address: '42 Bradley Cove Road', cityState: 'Russellville, AR 72801', phone: '(479) 890-6161', items: '' },
    { storeCode: 'Store 606', address: '8300 State Highway 108', cityState: 'Texarkana, AR 71854', phone: '(870) 774-3595', items: '' },
    { storeCode: 'Store 737', address: '1815 N Foster Road', cityState: 'San Antonio, TX 78244', phone: '(210) 666-2266', items: '' },
    { storeCode: 'Store 726', address: '7425 Bonnie View Road', cityState: 'Dallas, TX 75241', phone: '(972) 225-3566', items: '' },
    { storeCode: 'Store 730', address: '1011 Beltway Parkway', cityState: 'Laredo, TX 78045', phone: '(956) 712-3265', items: '' },
    { storeCode: 'Store 727', address: '1305 E Monte Cristo Rd', cityState: 'Edinburg, TX 78542', phone: '(956) 316-0149', items: '' },
    { storeCode: 'Store 729', address: '15919 North Freeway', cityState: 'Houston, TX 77090', phone: '(281) 893-0423', items: '' },
    { storeCode: 'Store 665', address: '9510 Greenwood Road', cityState: 'Greenwood, LA 71033', phone: '(318) 938-7744', items: '' },
    { storeCode: 'Store 660', address: '15236 State Route 180', cityState: 'Catlettsburg, KY 41129', phone: '(606) 928-8383', items: '' },
    { storeCode: 'Store 662', address: '18750 Herndon Oak Grove Rd.', cityState: 'Oak Grove, KY 42262', phone: '(270) 640-7000', items: '' },
    { storeCode: 'Store 661', address: '4380 Nashville Road', cityState: 'Franklin, KY 42134', phone: '(270) 586-3343', items: '' },
    { storeCode: 'Store 664', address: '13019 Walton Verona Rd', cityState: 'Walton, KY 41094', phone: '(859) 485-4400', items: '' },
    { storeCode: 'Store 636', address: '8200 N.W. Blvd.', cityState: 'Davenport, IA 52806', phone: '(563) 386-7710', items: '' },
    { storeCode: 'Store 572', address: '3040 220th St', cityState: 'Williams, IA 50271', phone: '(515) 516-0821', items: '' },
    { storeCode: 'Store 1080', address: '2275 Sperry Avenue', cityState: 'Patterson, CA 95363', phone: '(209) 892-9225', items: '' },
    { storeCode: 'Store 1177', address: '14320 Slover Ave.', cityState: 'Fontana, CA 92337', phone: '(909) 574-4866', items: '' },
    { storeCode: 'Store 627', address: '2990 US Hwy 17 South', cityState: 'Brunswick, GA 31523', phone: '(912) 280-0006', items: '' },
    { storeCode: 'Store 631', address: '7001 Bellville Rd', cityState: 'Lake Park, GA 31636', phone: '(229) 559-6500', items: '' },
    { storeCode: 'Store 633', address: '3600 Highway 77 South', cityState: 'Greensboro, GA 30642', phone: '(706) 486-4835', items: '' },
    { storeCode: 'Store 632', address: '288 Resaca Beach Blvd NW', cityState: 'Resaca, GA 30735', phone: '(706) 629-1541', items: '' }
  ];

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(flyingJCompany.id, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  insertMany(flyingJStores);
  console.log(`✅ Seeded ${flyingJStores.length} Flying J stores`);
}

// Seed Pilot Travel Centers stores from provided data
export function seedPilotStores(): void {
  // Get Pilot Travel Centers company ID
  const pilotCompany = db.prepare('SELECT id FROM companies WHERE name LIKE ?').get("%Pilot%") as { id: number } | undefined;
  
  if (!pilotCompany) {
    console.log('⚠️  Pilot Travel Centers company not found, skipping store seeding');
    return;
  }

  const pilotStores = [
    { storeCode: 'Store 4649', address: '713 Oakland Circle', cityState: 'Raphine, VA 24472', phone: '(540) 377-923', items: 'Truck Diesel' },
    { storeCode: 'Store 396', address: '3541 Lee Jackson Highway', cityState: 'Staunton, VA 24401', phone: '(540) 324-0714', items: 'DEF Fuel Item' },
    { storeCode: 'Store 256', address: '110 River Point Dr', cityState: 'Danville, VA 24540', phone: '(434) 792-1180', items: 'Reefer Fuel' },
    { storeCode: 'Store 491', address: '3634 North Valley Pike', cityState: 'Harrisonburg, VA 22802', phone: '(540) 434-2529', items: 'Cash Advance Item' },
    { storeCode: 'Store 4619', address: '1318 East Lee Highway', cityState: 'Wytheville, VA 24382', phone: '(276) 228-2421', items: '' },
    { storeCode: 'Store 348', address: '205 Wilson Road', cityState: 'Bentleyville, PA 15314', phone: '(724) 774-0811', items: '' },
    { storeCode: 'Store 81', address: '2010 New Castle Road', cityState: 'Portersville, PA 16051', phone: '(724) 368-3028', items: '' },
    { storeCode: 'Store 503', address: '2309 Smithtown Road', cityState: 'Morgantown, WV 26508', phone: '(304) 284-8518', items: '' },
    { storeCode: 'Store 243', address: '4304 First Avenue', cityState: 'Nitro, WV 25143', phone: '(304) 755-8654', items: '' },
    { storeCode: 'Store 7996', address: '2700 Chamber Dr', cityState: 'Monroe, NC 28110', phone: '(980) 315-4010', items: '' },
    { storeCode: 'Store 6996', address: '2574 W NC Highway 24', cityState: 'Warsaw, NC 28398', phone: '(910) 293-7070', items: '' },
    { storeCode: 'Store 275', address: '3807 Statesville Avenue', cityState: 'Charlotte, NC 28206', phone: '(704) 358-1006', items: '' },
    { storeCode: 'Store 7983', address: '985 Peeler Road', cityState: 'Salisbury, NC 28147', phone: '(704) 255-5238', items: '' },
    { storeCode: 'Store 4566', address: '2768 East Cherokee Street', cityState: 'Blacksburg, SC 29702', phone: '(864) 936-9984', items: '' },
    { storeCode: 'Store 1082', address: '5714 N Rhett Ave', cityState: 'Charleston, SC 29406', phone: '(843) 745-9300', items: '' },
    { storeCode: 'Store 4569', address: '15976 Whyte Hardee Blvd', cityState: 'Hardeeville, SC 29927', phone: '(843) 784-3350', items: '' },
    { storeCode: 'Store 87', address: '1050 US 301 South', cityState: 'Jacksonville, FL 32234', phone: '(904) 266-4238', items: '' },
    { storeCode: 'Store 500', address: '8067 W FL-6', cityState: 'Jasper, FL 32052', phone: '(386) 638-1635', items: '' },
    { storeCode: 'Store 293', address: '2020 SW Highway 484', cityState: 'Ocala, FL 34473', phone: '(352) 347-8555', items: '' },
    { storeCode: 'Store 96', address: '3051 State Road 60', cityState: 'Okeechobee, FL 34972', phone: '(407) 436-1224', items: '' },
    { storeCode: 'Store 352', address: '6050 Plaza Drive', cityState: 'Fort Myers, FL 33905', phone: '(239) 693-6868', items: '' },
    { storeCode: 'Store 874', address: '17696 SW 8th St', cityState: 'Miami, FL 33194', phone: '(305) 553-4594', items: '' },
    { storeCode: 'Store 17', address: '15901 Eleven Mile Road', cityState: 'Battle Creek, MI 49014', phone: '(269) 968-9949', items: '' },
    { storeCode: 'Store 243', address: '1100 North Dixie Highway', cityState: 'Monroe, MI 48162', phone: '(734) 242-9650', items: '' },
    { storeCode: 'Store 296', address: '195 Baker Road', cityState: 'Dexter, MI 48130', phone: '(734) 426-0065', items: '' },
    { storeCode: 'Store 2', address: '2246 OH-45', cityState: 'Austinburg, OH 44010', phone: '(440) 275-3303', items: '' },
    { storeCode: 'Store 213', address: '3600 Interchange Road', cityState: 'Columbus, OH 43204', phone: '(614) 308-9195', items: '' },
    { storeCode: 'Store 15', address: '5820 Hagman Road', cityState: 'Toledo, OH 43612', phone: '(419) 729-3985', items: '' },
    { storeCode: 'Store 1126', address: '8801 NE Birmingham Road', cityState: 'Kansas City, MO 64161', phone: '(816) 453-0076', items: '' },
    { storeCode: 'Store 442', address: '1701 MO-84', cityState: 'Hayti, MO 63851', phone: '(573) 359-2007', items: '' },
    { storeCode: 'Store 492', address: '170 Valley Street', cityState: 'Arkadelphia, AR 71923', phone: '(870) 245-3119', items: '' },
    { storeCode: 'Store 430', address: '215 SR 331 North', cityState: 'Russellville, AR 72802', phone: '(479) 967-7414', items: '' },
    { storeCode: 'Store 467', address: '4105 S. Loop 1604', cityState: 'San Antonio, TX 78264', phone: '(210) 626-9183', items: '' },
    { storeCode: 'Store 433', address: '8787 South Lancaster Road', cityState: 'Dallas, TX 75241', phone: '(972) 228-2467', items: '' },
    { storeCode: 'Store 377', address: '1101 Uniroyal Drive', cityState: 'Laredo, TX 78045', phone: '(956) 717-5006', items: '' },
    { storeCode: 'Store 1023', address: '1920 East Denman Avenue', cityState: 'Lufkin, TX 75901', phone: '(936) 899-7101', items: '' },
    { storeCode: 'Store 1470', address: '2360 US-59', cityState: 'Carthage, TX 75633', phone: '(903) 263-0586', items: '' },
    { storeCode: 'Store 375', address: '4440 N McCarty St', cityState: 'Houston, TX 77013', phone: '(713) 675-3375', items: '' },
    { storeCode: 'Store 1247', address: '1888 US 82', cityState: 'New Boston, TX 75570', phone: '(903) 628-0000', items: '' },
    { storeCode: 'Store 300', address: '2111 SW Railroad Avenue', cityState: 'Hammond, LA 70403', phone: '(985) 323-5739', items: '' },
    { storeCode: 'Store 428', address: '300 Well Road', cityState: 'West Monroe, LA 71292', phone: '(318) 329-3590', items: '' },
    { storeCode: 'Store 439', address: '12900 Fort Campbell Boulevard', cityState: 'Oak Grove, KY 42262', phone: '(270) 439-0153', items: '' },
    { storeCode: 'Store 438', address: '2940 Scottsville Road', cityState: 'Franklin, KY 42134', phone: '(270) 586-9544', items: '' },
    { storeCode: 'Store 321', address: '11229 Frontage Road', cityState: 'Walton, KY 41094', phone: '(859) 365-0368', items: '' },
    { storeCode: 'Store 594', address: '2815 Singing Hills Blvd.', cityState: 'Sioux City, IA 51111', phone: '(712) 258-3816', items: '' },
    { storeCode: 'Store 131', address: '2010 West Clay Street', cityState: 'Osceola, IA 50213', phone: '(641) 342-8658', items: '' },
    { storeCode: 'Store 613', address: '17047 Zachary Ave', cityState: 'Bakersfield, CA 93308', phone: '(661) 392-5300', items: '' },
    { storeCode: 'Store 200', address: '5725 CA-58', cityState: 'Boron, CA 93516', phone: '(760) 762-0041', items: '' },
    { storeCode: 'Store 255', address: '433 Old Gate Lane', cityState: 'Milford, CT 06460', phone: '(203) 876-1266', items: '' },
    { storeCode: 'Store 260', address: '310 Cordele Road', cityState: 'Albany, GA 31705', phone: '(229) 878-1355', items: '' },
    { storeCode: 'Store 192', address: '4431 Union Road', cityState: 'Tifton, GA 31794', phone: '(229) 382-7295', items: '' }
  ];

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(pilotCompany.id, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  insertMany(pilotStores);
  console.log(`✅ Seeded ${pilotStores.length} Pilot Travel Centers stores`);
}

// Seed ONE 9 Fuel Network stores from provided data
export function seedOne9Stores(): void {
  // Get ONE 9 Fuel Network company ID
  const one9Company = db.prepare('SELECT id FROM companies WHERE name LIKE ?').get("%ONE 9%") as { id: number } | undefined;
  
  if (!one9Company) {
    console.log('⚠️  ONE 9 Fuel Network company not found, skipping store seeding');
    return;
  }

  const one9Stores = [
    { storeCode: 'Store 1414', address: '5151 N Fork Road', cityState: 'Elliston, VA 24087', phone: '(540) 268-9500', items: 'Truck Diesel' },
    { storeCode: 'Store 245', address: '7961 Linglestown Road', cityState: 'Harrisburg, PA 17112', phone: '(717) 545-5507', items: 'Cash Advance Item' },
    { storeCode: 'Store 58', address: '2032 Highway 48', cityState: 'Pleasant Hill, NC 27866', phone: '(252) 537-4476', items: '' },
    { storeCode: 'Store 4567', address: '1155 South Anderson Road', cityState: 'Rock Hill, SC 29730', phone: '(803) 329-0078', items: '' },
    { storeCode: 'Store 713', address: '111 Mill Branch Road', cityState: 'Latta, SC 29565', phone: '(843) 752-5047', items: '' },
    { storeCode: 'Store 1403', address: '6723 US-129', cityState: 'Jasper, FL 32052', phone: '(386) 792-1898', items: '' },
    { storeCode: 'Store 89', address: '1526 51st Ave E', cityState: 'Ellenton, FL 34222', phone: '(941) 729-6288', items: '' },
    { storeCode: 'Store 1401', address: '14170 US-441', cityState: 'Lake City, FL 32024', phone: '(386) 754-6511', items: '' },
    { storeCode: 'Store 1402', address: '2091 Hwy 71', cityState: 'Marianna, FL 32448', phone: '(850) 633-2467', items: '' },
    { storeCode: 'Store 23', address: '7205 South State Road', cityState: 'Ionia, MI 48846', phone: '(616) 527-6520', items: '' },
    { storeCode: 'Store 16', address: '5772 N US Hwy 68', cityState: 'Wilmington, OH 45177', phone: '(937) 382-0464', items: '' },
    { storeCode: 'Store 1318', address: '325 E Evergreen Street', cityState: 'Strafford, MO 65757', phone: '(417) 736-0017', items: '' },
    { storeCode: 'Store 301', address: '917 East Elm Street', cityState: 'Marston, MO 63866', phone: '(573) 643-2320', items: '' },
    { storeCode: 'Store 1330', address: '2101 Highway 49', cityState: 'Brinkley, AR 72021', phone: '(870) 638-4135', items: '' },
    { storeCode: 'Store 1416', address: '4880 Mountain Creek Pkwy', cityState: 'Dallas, TX 75236', phone: '(972) 709-7560', items: '' },
    { storeCode: 'Store 1285', address: '87125 IH 20', cityState: 'Santo, TX 76472', phone: '(940) 769-2584', items: '' },
    { storeCode: 'Store 1417', address: '12016 I-35', cityState: 'Lorena, TX 76655', phone: '(254) 655-5165', items: '' },
    { storeCode: 'Store 1418', address: '1120 FM 775', cityState: 'Seguin, TX 78155', phone: '(830) 415-0901', items: '' },
    { storeCode: 'Store 1300', address: '2200 W Lake Bardwell Drive', cityState: 'Ennis, TX 75119', phone: '(972) 875-3500', items: '' },
    { storeCode: 'Store 1282', address: '1100 FM 148', cityState: 'Terrell, TX 75160', phone: '(972) 524-0859', items: '' },
    { storeCode: 'Store 1304', address: '1000 NE Loop 820', cityState: 'Fort Worth, TX 76106', phone: '(682) 365-4152', items: '' },
    { storeCode: 'Store 1295', address: '16243 US-271N', cityState: 'Tyler, TX 75708', phone: '(903) 877-0800', items: '' },
    { storeCode: 'Store 1291', address: '2606 FM174', cityState: 'Bowie, TX 76230', phone: '(940) 872-8804', items: '' },
    { storeCode: 'Store 1334', address: '13965 South I-35', cityState: 'Valley View, TX 76272', phone: '(940) 726-5643', items: '' },
    { storeCode: 'Store 1379', address: '3004 I-30', cityState: 'Greenville, TX 75402', phone: '(430) 242-1134', items: '' },
    { storeCode: 'Store 79', address: '2601 South Range Avenue', cityState: 'Denham Springs, LA 70726', phone: '(225) 665-4151', items: '' },
    { storeCode: 'Store 1463', address: '18889 S Frontage Rd', cityState: 'Welsh, LA 70591', phone: '(337) 358-4030', items: '' },
    { storeCode: 'Store 46', address: '2929 Scottsville Rd', cityState: 'Franklin, KY 42134', phone: '(270) 586-4149', items: '' },
    { storeCode: 'Store 496', address: '2086 Atalissa Road', cityState: 'Atalissa, IA 52720', phone: '(563) 946-3761', items: '' },
    { storeCode: 'Store 1361', address: '14749 Thornton Road', cityState: 'Lodi, CA 95242', phone: '(209) 368-8100', items: '' },
    { storeCode: 'Store 1424', address: '7051 McCracken Rd', cityState: 'Westley, CA 95387', phone: '(209) 343-5010', items: '' },
    { storeCode: 'Store 1447', address: '550 Wake Ave', cityState: 'El Centro, CA 92243', phone: '(760) 352-0044', items: '' },
    { storeCode: 'Store 1434', address: '14416 Slover Ave', cityState: 'Fontana, CA 92337', phone: '(909) 822-4415', items: '' },
    { storeCode: 'Store 254', address: '650 Highway 299', cityState: 'Wildwood, GA 30757', phone: '(706) 820-7353', items: '' },
    { storeCode: 'Store 398', address: '39 Victory Lane', cityState: 'Vienna, GA 31092', phone: '(229) 268-1414', items: '' },
    { storeCode: 'Store 777', address: '3353 Federal Way', cityState: 'Boise, ID 83705', phone: '(208) 802-7985', items: '' },
    { storeCode: 'Store 1428', address: '122 West Simplot Blvd', cityState: 'Caldwell, ID 83605', phone: '(208) 459-0027', items: '' },
    { storeCode: 'Store 1429', address: '2001 Highway 30 West', cityState: 'Fruitland, ID 83619', phone: '(208) 452-5105', items: '' },
    { storeCode: 'Store 1341', address: '1801 Pioneer Hwy US I-5', cityState: 'Arlington, WA 98223', phone: '(360) 652-6066', items: '' },
    { storeCode: 'Store 963', address: '3709 S Geiger Blvd', cityState: 'Spokane, WA 99224', phone: '(509) 456-8843', items: '' },
    { storeCode: 'Store 965', address: '2300 S Canyon Rd', cityState: 'Ellensburg, WA 98926', phone: '(509) 215-5014', items: '' },
    { storeCode: 'Store 1224', address: '3936 Miriam Ave', cityState: 'Bismarck, ND 58501', phone: '(701) 222-1675', items: '' },
    { storeCode: 'Store 265', address: '1111 S Jefferson Ave', cityState: 'Cookeville, TN 38506', phone: '(931) 528-7100', items: '' },
    { storeCode: 'Store 226', address: '505 Patriot Dr', cityState: 'Dandridge, TN 37725', phone: '(865) 397-3547', items: '' },
    { storeCode: 'Store 1366', address: '15060 S 641', cityState: 'Holladay, TN 38341', phone: '(731) 734-0060', items: '' },
    { storeCode: 'Store 403', address: '1915 E Raccoon Valley Dr', cityState: 'Heiskell, TN 37754', phone: '(865) 938-1439', items: '' },
    { storeCode: 'Store 484', address: '43 W Park Ave', cityState: 'Ash Fork, AZ 86320', phone: '(928) 754-1285', items: '' },
    { storeCode: 'Store 1411', address: '1275 East Business Loop', cityState: 'Bowie, AZ 85605', phone: '(520) 847-2511', items: '' },
    { storeCode: 'Store 1270', address: '1851 State Highway 77', cityState: 'Holbrook, AZ 86025', phone: '(928) 524-1400', items: '' },
    { storeCode: 'Store 1251', address: '399 McCormick St', cityState: 'Wamsutter, WY 82336', phone: '(307) 372-9196', items: '' }
  ];

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(one9Company.id, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  insertMany(one9Stores);
  // Ensure ONE 9 has the requested items available across all stores
  db.prepare('UPDATE stores SET items = ? WHERE companyId = ?')
    .run('Cash Advance Items, Truck Diesel, Reefer Fuel, DEF Fuel Item', one9Company.id);
  console.log(`✅ Seeded ${one9Stores.length} ONE 9 Fuel Network stores (items normalized to Truck Diesel, Reefer Fuel, DEF Fuel Item)`);
}

// Seed Travelcenters of America stores from provided data
export function seedTravelcentersStores(): void {
  // Get Travelcenters of America company ID
  const travelcentersCompany = db.prepare('SELECT id FROM companies WHERE name LIKE ?').get("%Travelcenters%") as { id: number } | undefined;
  
  if (!travelcentersCompany) {
    console.log('⚠️  Travelcenters of America company not found, skipping store seeding');
    return;
  }

  const travelcentersStores = [
    { storeCode: 'TA Ashland #1', address: '100 North Carter Rd', cityState: 'Ashland Virginia 23005', phone: '804-798-6011', items: 'Fuel, Diesel' },
    { storeCode: 'TA Whitsett #2', address: '1101 NC Highway 61', cityState: 'Whitsett North Carolina 27377', phone: '336-449-6060', items: 'Fuel, Diesel' },
    { storeCode: 'TA Brookville #3', address: '245 Allegheny Blvd.', cityState: 'Brookville Pennsylvania 15825', phone: '814-849-3051', items: 'Fuel, Diesel' },
    { storeCode: 'TA Columbia #6', address: '2 Simpson Road', cityState: 'Columbia New Jersey 7832', phone: '908-496-4124', items: 'Fuel, Diesel' },
    { storeCode: 'TA Eloy #7', address: '2949 North Toltec Road', cityState: 'Eloy Arizona 85131', phone: '520-466-7363', items: 'Fuel, Diesel' },
    { storeCode: 'TA Gallup #8', address: '3404 W Historical Highway 66', cityState: 'Gallup New Mexico 87301', phone: '505-863-6801', items: 'Fuel, Diesel' },
    { storeCode: 'TA Gary #10', address: '2510 Burr St.', cityState: 'Gary Indiana 46406', phone: '219-845-3721', items: 'Fuel, Diesel' },
    { storeCode: 'TA Eaton #11', address: '6762 US Rte 127', cityState: 'Eaton Ohio 45320', phone: '937-456-5522', items: 'Fuel, Diesel' },
    { storeCode: 'TA Harrisburg #12', address: '7848 Linglestown Road', cityState: 'Harrisburg Pennsylvania 17112', phone: '717-652-4556', items: 'Fuel, Diesel' },
    { storeCode: 'TA Las Cruces #14', address: '202 N. Motel Blvd', cityState: 'Las Cruces New Mexico 88007', phone: '575-527-7400', items: 'Fuel, Diesel' },
    { storeCode: 'TA Seville #15', address: '8834 Lake Road', cityState: 'Seville Ohio 44273', phone: '330-769-2053', items: 'Fuel, Diesel' },
    { storeCode: 'TA Tuscaloosa #16', address: '3501 Buttermilk Road', cityState: 'Tuscaloosa Alabama 35453', phone: '205-554-0215', items: 'Fuel, Diesel' },
    { storeCode: 'TA Baytown #17', address: '6800 Thompson Road', cityState: 'Baytown Texas 77521', phone: '281-424-7772', items: 'Fuel, Diesel' },
    { storeCode: 'TA Concordia #18', address: '102 N W 4th Street', cityState: 'Concordia Missouri 64020', phone: '660-463-2001', items: 'Fuel, Diesel' },
    { storeCode: 'TA Elkton #19', address: '1400 Elkton Road', cityState: 'Elkton Maryland 21921', phone: '410-398-7000', items: 'Fuel, Diesel' },
    { storeCode: 'TA Willington #22', address: '327 Ruby Road', cityState: 'Willington Connecticut 6279', phone: '860-684-0499', items: 'Fuel, Diesel' },
    { storeCode: 'TA Santa Rosa #23', address: '2634 Historic Route 66', cityState: 'Santa Rosa New Mexico 88435', phone: '575-935-9939', items: 'Fuel, Diesel' },
    { storeCode: 'TA London #24', address: '940 US RT 42 NE', cityState: 'London Ohio 43140', phone: '740-852-3810', items: 'Fuel, Diesel' },
    { storeCode: 'TA Duncan #25', address: '1402 East Main St.', cityState: 'Duncan South Carolina 29334', phone: '864-433-0711', items: 'Fuel, Diesel' },
    { storeCode: 'TA Walton #28', address: '145 Richwood Road', cityState: 'Walton Kentucky 41094', phone: '859-485-4111', items: 'Fuel, Diesel' },
    { storeCode: 'TA Kingsville #29', address: '5551 St Rt 193', cityState: 'Kingsville Ohio 44048', phone: '440-224-2035', items: 'Fuel, Diesel' },
    { storeCode: 'TA Zion #30', address: '16650 W. Russell Road', cityState: 'Zion Illinois 60099', phone: '847-395-5580', items: 'Fuel, Diesel' },
    { storeCode: 'TA Valley Grove #32', address: '270 W. Alexander Road', cityState: 'Valley Grove West Virginia 26060', phone: '304-547-1521', items: 'Fuel, Diesel' },
    { storeCode: 'TA Earle #33', address: '408 Highway 149 North', cityState: 'Earle Arkansas 72331', phone: '870-657-2105', items: 'Fuel, Diesel' },
    { storeCode: 'TA Effingham #35', address: '1702 West Evergreen Ave', cityState: 'Effingham Illinois 62401', phone: '217-347-7183', items: 'Fuel, Diesel' },
    { storeCode: 'TA Oklahoma City #36', address: '801 South Council Road', cityState: 'Oklahoma City Oklahoma 73128', phone: '405-787-7411', items: 'Fuel, Diesel' },
    { storeCode: 'TA Hebron #39', address: '10679 Lancaster Road, SE', cityState: 'Hebron Ohio 43025', phone: '740-467-2900', items: 'Fuel, Diesel' },
    { storeCode: 'TA Coachella #41', address: '46155 Dillon Road', cityState: 'Coachella California 92236', phone: '760-342-6200', items: 'Fuel, Diesel' },
    { storeCode: 'TA Mt. Vernon #43', address: '4510 Broadway St', cityState: 'Mt. Vernon Illinois 62864', phone: '618-244-4242', items: 'Fuel, Diesel' }
  ];

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(travelcentersCompany.id, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  insertMany(travelcentersStores);
  console.log(`✅ Seeded ${travelcentersStores.length} Travelcenters of America stores`);
}

// Seed Canadian company stores
export function seedCanadianStores(): void {
  // Get Canadian company IDs
  const flyingJCompany = db.prepare('SELECT id FROM companies WHERE name = ? AND country = ?').get('Flying J', 'Canada') as { id: number } | undefined;
  const huskyCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('Husky') as { id: number } | undefined;
  const petroCanadaCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('Petro-Canada') as { id: number } | undefined;
  const pearsonMartCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('Pearson Mart Esso') as { id: number } | undefined;
  const bvdPetroleumVancouverCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('BVD Petroleum Vancouver') as { id: number } | undefined;
  const bvdPetroleumCompany = db.prepare('SELECT id FROM companies WHERE name = ?').get('BVD Petroleum') as { id: number } | undefined;

  const insert = db.prepare(`
    INSERT INTO stores (companyId, storeCode, address, cityState, phone, items)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((stores) => {
    for (const store of stores) {
      insert.run(store.companyId, store.storeCode, store.address, store.cityState, store.phone, store.items);
    }
  });

  const canadianStores = [];

  // Flying J stores (Canada) - Updated with real store data
  if (flyingJCompany) {
    const flyingJStores = [
      { companyId: flyingJCompany.id, storeCode: 'Store 693', address: '8484 Alleghany Road', cityState: 'Corfu, NY 14036', phone: '(585) 599-4430', items: 'Truck Diesel' },
      { companyId: flyingJCompany.id, storeCode: 'Store 380', address: '107 Seventh North Street', cityState: 'Liverpool, NY 13088', phone: '(315) 424-0124', items: 'DEF Fuel Item' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1317', address: '164 Riverside Drive', cityState: 'Fultonville, NY 12072', phone: '(518) 414-0591', items: 'Reefer Fuel' },
      { companyId: flyingJCompany.id, storeCode: 'Store 494', address: '1128 Duanesburg Road', cityState: 'Schenectady, NY 12306', phone: '(518) 356-5616', items: 'Cash Advance Item' },
      { companyId: flyingJCompany.id, storeCode: 'Store 394', address: '239 Route 17K', cityState: 'Newburgh, NY 12550', phone: '(845) 567-1722', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 707', address: '246 Allegheny Blvd', cityState: 'Brookville, PA 15825', phone: '(814) 849-2992', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 4563', address: '7833 Linglestown Road', cityState: 'Harrisburg, PA 17112', phone: '(717) 901-6186', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 370', address: '417 Route 315', cityState: 'Pittston, PA 18640', phone: '(570) 655-4116', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 311', address: '8035 Perry Hwy', cityState: 'Erie, PA 16509', phone: '(814) 864-8536', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 708', address: '1501 Harrisburg Pike', cityState: 'Carlisle, PA 17015', phone: '(717) 243-6659', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 348', address: '205 Wilson Road', cityState: 'Bentleyville, PA 15314', phone: '(724) 774-0811', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 752', address: '1530 Rest Church Road', cityState: 'Clear Brook, VA 22624', phone: '(540) 678-3641', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 754', address: '3249 Chapman Road', cityState: 'Wytheville, VA 24382', phone: '(276) 228-7110', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 876', address: '23866 Rogers Clark Blvd.', cityState: 'Ruther Glen, VA 22546', phone: '(804) 448-3077', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 749', address: '24279 Rogers Clark Boulevard', cityState: 'Ruther Glen, VA 22546', phone: '(804) 448-9047', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 683', address: '1800 Princeton Kenly Rd', cityState: 'Kenly, NC 27542', phone: '(919) 284-4548', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 711', address: '1011 North Mountain St', cityState: 'Blacksburg, SC 29702', phone: '(864) 839-5934', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 712', address: '5901 Fairfield Road', cityState: 'Columbia, SC 29203', phone: '(803) 735-9006', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1068', address: '799 Jedburg Road', cityState: 'Summerville, SC 29483', phone: '(843) 851-2023', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 714', address: '2435 Mount Holly Road', cityState: 'Rock Hill, SC 29730', phone: '(803) 328-5700', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 623', address: '32670 Blue Star Hwy', cityState: 'Midway, FL 32343', phone: '(850) 574-9779', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1096', address: '1101 Friday Road', cityState: 'Cocoa, FL 32926', phone: '(321) 433-3150', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 622', address: '100 North Kings Hwy', cityState: 'Fort Pierce, FL 34945', phone: '(772) 461-0091', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 895', address: '21055 West Road', cityState: 'Woodhaven, MI 48183', phone: '(313) 524-9985', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 668', address: '3475 E Washington Rd', cityState: 'Saginaw, MI 48601', phone: '(989) 752-6350', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 694', address: '2349 Center Road', cityState: 'Austinburg, OH 44010', phone: '(440) 275-1515', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 552', address: '3140 OH-350', cityState: 'Lebanon, OH 45036', phone: '(513) 933-0312', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 696', address: '7735 E State Rt 37', cityState: 'Sunbury, OH 43074', phone: '(740) 965-9835', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 768', address: '1300 N. Corrington Avenue', cityState: 'Kansas City, MO 64120', phone: '(816) 483-7600', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1061', address: '4939 West Chestnut Expressway', cityState: 'Springfield, MO 65802', phone: '(417) 864-4175', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 671', address: '703 State Hwy 80', cityState: 'Matthews, MO 63867', phone: '(573) 472-3336', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 605', address: '42 Bradley Cove Road', cityState: 'Russellville, AR 72801', phone: '(479) 890-6161', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 606', address: '8300 State Highway 108', cityState: 'Texarkana, AR 71854', phone: '(870) 774-3595', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 737', address: '1815 N Foster Road', cityState: 'San Antonio, TX 78244', phone: '(210) 666-2266', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 726', address: '7425 Bonnie View Road', cityState: 'Dallas, TX 75241', phone: '(972) 225-3566', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 730', address: '1011 Beltway Parkway', cityState: 'Laredo, TX 78045', phone: '(956) 712-3265', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 727', address: '1305 E Monte Cristo Rd', cityState: 'Edinburg, TX 78542', phone: '(956) 316-0149', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 729', address: '15919 North Freeway', cityState: 'Houston, TX 77090', phone: '(281) 893-0423', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 665', address: '9510 Greenwood Road', cityState: 'Greenwood, LA 71033', phone: '(318) 938-7744', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 660', address: '15236 State Route 180', cityState: 'Catlettsburg, KY 41129', phone: '(606) 928-8383', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 662', address: '18750 Herndon Oak Grove Rd.', cityState: 'Oak Grove, KY 42262', phone: '(270) 640-7000', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 661', address: '4380 Nashville Road', cityState: 'Franklin, KY 42134', phone: '(270) 586-3343', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 664', address: '13019 Walton Verona Rd', cityState: 'Walton, KY 41094', phone: '(859) 485-4400', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 636', address: '8200 N.W. Blvd.', cityState: 'Davenport, IA 52806', phone: '(563) 386-7710', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 572', address: '3040 220th St', cityState: 'Williams, IA 50271', phone: '(515) 516-0821', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1080', address: '2275 Sperry Avenue', cityState: 'Patterson, CA 95363', phone: '(209) 892-9225', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 1177', address: '14320 Slover Ave.', cityState: 'Fontana, CA 92337', phone: '(909) 574-4866', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 627', address: '2990 US Hwy 17 South', cityState: 'Brunswick, GA 31523', phone: '(912) 280-0006', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 631', address: '7001 Bellville Rd', cityState: 'Lake Park, GA 31636', phone: '(229) 559-6500', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 633', address: '3600 Highway 77 South', cityState: 'Greensboro, GA 30642', phone: '(706) 486-4835', items: '' },
      { companyId: flyingJCompany.id, storeCode: 'Store 632', address: '288 Resaca Beach Blvd NW', cityState: 'Resaca, GA 30735', phone: '(706) 629-1541', items: '' }
    ];
    // Force only two items available for Flying J Canada across all stores
    const normalizedFjStores = flyingJStores.map(s => ({ ...s, items: 'Truck Diesel, DEF Fuel Item' }));
    canadianStores.push(...normalizedFjStores);
  }

  // Husky stores
  if (huskyCompany) {
    const huskyStores = [
      { companyId: huskyCompany.id, storeCode: 'DIXIE MART (MISSISSAUGA)', address: '7280 DIXIE RD', cityState: 'MISSISSAUGA, ON L5S 1E1', phone: '(905) 565-1476', items: 'Truck Diesel' },
      { companyId: huskyCompany.id, storeCode: 'ST. CATHARINES HUSKY TC/ESSO', address: '615 York Rd', cityState: 'St. Catharines, ON L0S 1J0', phone: '(905) 684-1128', items: 'DEF Fuel Item' },
      { companyId: huskyCompany.id, storeCode: 'KENNEDY RD HUSKY TC/ESSO', address: '6625 Kennedy Road', cityState: 'Mississauga, ON L5T 2W1', phone: '(905) 565-9548', items: 'Reefer Fuel' },
      { companyId: huskyCompany.id, storeCode: 'Dixie Rd Husky Tc/Esso', address: '1553 Shawson Drive', cityState: 'Mississauga, ON L4W 1T7', phone: '(905) 565-9090', items: 'Cash Advance Item' },
      { companyId: huskyCompany.id, storeCode: 'Stouffville Rd Husky Tc/Esso', address: '2210 Stouffville Rd', cityState: 'Gormley, ON L0H 1G0', phone: '(905) 887-0040', items: '' }
    ];
    canadianStores.push(...huskyStores);
  }

  // Petro-Canada stores
  if (petroCanadaCompany) {
    const petroCanadaStores = [
      { companyId: petroCanadaCompany.id, storeCode: 'PETRO-CANADA', address: '495 YORD RD', cityState: 'NIAGARA, ONTARIO L0S 1J0', phone: '(905) 684-1079', items: 'Fuel' },
      { companyId: petroCanadaCompany.id, storeCode: 'PETRO-CANADA', address: '18423 HURONTARIOS', cityState: 'CALEDON, ONTARIO L7K 0A8', phone: '(519) 927-9877', items: 'Pump' },
      { companyId: petroCanadaCompany.id, storeCode: 'PETRO-CANADA', address: '6070 DIXIE RD', cityState: 'MISSISSAUGA, ONTARIO L5T 1A6', phone: '(605) 564-2295', items: 'Diesel' },
      { companyId: petroCanadaCompany.id, storeCode: 'PETRO-CANADA', address: '81 UBE DRIVE', cityState: 'SARNIA, ONTARIO N7W 1B6', phone: '(519) 542-2014', items: 'DEF' },
      { companyId: petroCanadaCompany.id, storeCode: 'PETRO-CANADA', address: '130 DELTA PARK BLV', cityState: 'BRAMPTON, ONTARIO L6T 5E7', phone: '(905) 792-8828', items: 'Fuel, Pump' }
    ];
    canadianStores.push(...petroCanadaStores);
  }

  // Pearson Mart Esso stores
  if (pearsonMartCompany) {
    const pearsonMartStores = [
      { companyId: pearsonMartCompany.id, storeCode: 'Store 4001', address: '321 Airport Road', cityState: 'Toronto, ON M5H 1A1', phone: '(416) 555-0601', items: 'Gas, Convenience' },
      { companyId: pearsonMartCompany.id, storeCode: 'Store 4002', address: '654 Terminal 1', cityState: 'Toronto, ON M5H 1A1', phone: '(416) 555-0602', items: 'Gas, Snacks' },
      { companyId: pearsonMartCompany.id, storeCode: 'Store 4003', address: '789 Terminal 3', cityState: 'Toronto, ON M5H 1A1', phone: '(416) 555-0603', items: 'Diesel, Coffee' },
      { companyId: pearsonMartCompany.id, storeCode: 'Store 4004', address: '456 Airport Blvd', cityState: 'Toronto, ON M5H 1A1', phone: '(416) 555-0604', items: 'Gas, Car Wash' },
      { companyId: pearsonMartCompany.id, storeCode: 'Store 4005', address: '987 Runway Road', cityState: 'Toronto, ON M5H 1A1', phone: '(416) 555-0605', items: 'Gas, Convenience' }
    ];
    canadianStores.push(...pearsonMartStores);
  }

  // BVD Petroleum Vancouver stores
  if (bvdPetroleumVancouverCompany) {
    const bvdPetroleumVancouverStores = [
      { companyId: bvdPetroleumVancouverCompany.id, storeCode: 'Store 5001', address: '654 Main Street', cityState: 'Vancouver, BC V6B 1A1', phone: '(604) 555-0702', items: 'Gas, Diesel' },
      { companyId: bvdPetroleumVancouverCompany.id, storeCode: 'Store 5002', address: '321 Granville Street', cityState: 'Vancouver, BC V6B 1A1', phone: '(604) 555-0703', items: 'Gas, Convenience' },
      { companyId: bvdPetroleumVancouverCompany.id, storeCode: 'Store 5003', address: '789 Broadway', cityState: 'Vancouver, BC V6B 1A1', phone: '(604) 555-0704', items: 'Diesel, Car Wash' },
      { companyId: bvdPetroleumVancouverCompany.id, storeCode: 'Store 5004', address: '456 Robson Street', cityState: 'Vancouver, BC V6B 1A1', phone: '(604) 555-0705', items: 'Gas, Snacks' },
      { companyId: bvdPetroleumVancouverCompany.id, storeCode: 'Store 5005', address: '987 Davie Street', cityState: 'Vancouver, BC V6B 1A1', phone: '(604) 555-0706', items: 'Gas, Coffee' }
    ];
    canadianStores.push(...bvdPetroleumVancouverStores);
  }

  // BVD Petroleum stores
  if (bvdPetroleumCompany) {
    const bvdPetroleumStores = [
      { companyId: bvdPetroleumCompany.id, storeCode: 'BVD PETROLEUM', address: '130 Delta Park Blvd', cityState: 'Brampton, ON L6T 5M8', phone: '(905) 792-8828', items: 'Diesel' },
      { companyId: bvdPetroleumCompany.id, storeCode: 'BVD PETROLEUM', address: '495 York Road', cityState: 'Niagara, ON L0S 1J0', phone: '(905) 684-1079', items: 'Diesel' },
      { companyId: bvdPetroleumCompany.id, storeCode: 'BVD PETROLEUM', address: '6215 Boundary Rd', cityState: 'Cornwall, ON K6H 5R5', phone: '(613) 933-1234', items: 'Diesel' },
      { companyId: bvdPetroleumCompany.id, storeCode: 'BVD PETROLEUM', address: '6125 Ordan Dr', cityState: 'Mississauga, ON L5T 2M7', phone: '(905) 670-1234', items: 'Diesel' },
      { companyId: bvdPetroleumCompany.id, storeCode: 'BVD PETROLEUM', address: '7026 Industrial Dr', cityState: 'Comber, ON N0P 1J0', phone: '(519) 687-1234', items: 'Diesel' }
    ];
    canadianStores.push(...bvdPetroleumStores);
  }

  if (canadianStores.length > 0) {
    insertMany(canadianStores);
    // Ensure items are restricted for Flying J Canada even if upstream data changes
    if (flyingJCompany) {
      db.prepare('UPDATE stores SET items = ? WHERE companyId = ?').run('Truck Diesel, DEF Fuel Item', flyingJCompany.id);
    }
    console.log(`✅ Seeded ${canadianStores.length} Canadian company stores`);
  } else {
    console.log('⚠️  No Canadian companies found, skipping store seeding');
  }
}

// Get all companies
export function getAllCompanies(): Company[] {
  return db.prepare('SELECT * FROM companies ORDER BY name').all() as Company[];
}

// Get company by ID
export function getCompanyById(id: number): Company | undefined {
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Company | undefined;
}

// Add new company
export function addCompany(company: Omit<Company, 'id' | 'createdAt'>): Company {
  const insert = db.prepare(`
    INSERT INTO companies (name, address, email, phone, country, designId)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = insert.run(company.name, company.address, company.email, company.phone, company.country, company.designId);
  return getCompanyById(result.lastInsertRowid as number)!;
}

// Update company
export function updateCompany(id: number, company: Partial<Omit<Company, 'id' | 'createdAt'>>): Company | undefined {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (company.name !== undefined) { fields.push('name = ?'); values.push(company.name); }
  if (company.address !== undefined) { fields.push('address = ?'); values.push(company.address); }
  if (company.email !== undefined) { fields.push('email = ?'); values.push(company.email); }
  if (company.phone !== undefined) { fields.push('phone = ?'); values.push(company.phone); }
  if (company.country !== undefined) { fields.push('country = ?'); values.push(company.country); }
  if (company.designId !== undefined) { fields.push('designId = ?'); values.push(company.designId); }
  
  if (fields.length === 0) return getCompanyById(id);
  
  values.push(id);
  db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCompanyById(id);
}

// Delete company
export function deleteCompany(id: number): boolean {
  const result = db.prepare('DELETE FROM companies WHERE id = ?').run(id);
  return result.changes > 0;
}

// Get stores by company ID
export function getStoresByCompanyId(companyId: number): Store[] {
  return db.prepare('SELECT * FROM stores WHERE companyId = ? ORDER BY storeCode').all(companyId) as Store[];
}

// Get store by ID
export function getStoreById(id: number): Store | undefined {
  return db.prepare('SELECT * FROM stores WHERE id = ?').get(id) as Store | undefined;
}

// Get unique items for a company
export function getItemsByCompanyId(companyId: number): string[] {
  const stores = db.prepare("SELECT DISTINCT items FROM stores WHERE companyId = ? AND items != ''").all(companyId) as { items: string }[];
  const uniqueItems = new Set<string>();
  
  stores.forEach(store => {
    if (store.items) {
      // Split items by comma in case multiple items are listed
      store.items.split(',').forEach(item => {
        const trimmedItem = item.trim();
        if (trimmedItem) {
          uniqueItems.add(trimmedItem);
        }
      });
    }
  });
  
  return Array.from(uniqueItems).sort();
}

export default db;

