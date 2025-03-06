
import { db } from '../../db';
import { kavaBars } from '../../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function exportKavaBars() {
  console.log('Exporting kava bars data...');
  
  try {
    // Fetch all kava bars from the database
    const allBars = await db.select().from(kavaBars);
    console.log(`Found ${allBars.length} kava bars to export`);

    const exportDir = path.join(process.cwd(), 'exports');
    
    // Create exports directory if it doesn't exist
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    // Export to JSON
    const jsonPath = path.join(exportDir, 'kava_bars_export.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allBars, null, 2), 'utf8');
    console.log(`JSON export saved to: ${jsonPath}`);

    // Export to CSV
    const csvPath = path.join(exportDir, 'kava_bars_export.csv');
    // Create CSV header
    const header = Object.keys(allBars[0] || {}).join(',');
    
    // Create CSV rows
    const rows = allBars.map(bar => {
      return Object.values(bar).map(value => {
        // Handle special types like objects, arrays, dates
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return value;
      }).join(',');
    });
    
    fs.writeFileSync(csvPath, [header, ...rows].join('\n'), 'utf8');
    console.log(`CSV export saved to: ${csvPath}`);

    // Export to SQL
    const sqlPath = path.join(exportDir, 'kava_bars_export.sql');
    let sqlContent = 'INSERT INTO kava_bars (';
    
    // Column names
    sqlContent += Object.keys(allBars[0] || {}).join(', ');
    sqlContent += ') VALUES\n';
    
    // Values for each row
    const valueRows = allBars.map(bar => {
      return '(' + Object.values(bar).map(value => {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'object' && value instanceof Date) return `'${value.toISOString()}'`;
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        return value;
      }).join(', ') + ')';
    });
    
    sqlContent += valueRows.join(',\n') + ';\n';
    fs.writeFileSync(sqlPath, sqlContent, 'utf8');
    console.log(`SQL export saved to: ${sqlPath}`);

    console.log('Export complete! You can find the files in the exports directory.');
    
  } catch (error) {
    console.error('Error exporting kava bars:', error);
  } finally {
    process.exit(0);
  }
}

// Run the export function
exportKavaBars();
