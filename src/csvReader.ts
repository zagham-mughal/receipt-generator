import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Company } from './types';

export class CSVReader {
  /**
   * Read companies from CSV file
   */
  async readCompanies(filePath: string): Promise<Company[]> {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    return records.map((record: any) => ({
      name: record.name || record.company || record.Company || record.Name,
      address: record.address || record.Address || '',
      email: record.email || record.Email || ''
    }));
  }
}

