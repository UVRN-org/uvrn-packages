/**
 * Unit tests for CLI argument parsing and basic functionality
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../dist/cli.js');

describe('Delta Engine CLI', () => {
  describe('Version and Help', () => {
    test('should display version', () => {
      const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf-8' });
      expect(output.trim()).toBe('1.0.0');
    });

    test('should display help', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf-8' });
      expect(output).toContain('CLI for Loosechain Delta Engine');
      expect(output).toContain('run');
      expect(output).toContain('validate');
      expect(output).toContain('verify');
    });

    test('should display command help for run', () => {
      const output = execSync(`node ${CLI_PATH} run --help`, { encoding: 'utf-8' });
      expect(output).toContain('Execute delta engine');
      expect(output).toContain('--output');
      expect(output).toContain('--quiet');
      expect(output).toContain('--pretty');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      const tempFile = path.join(__dirname, 'temp-invalid.json');
      fs.writeFileSync(tempFile, invalidJson);

      try {
        execSync(`node ${CLI_PATH} run ${tempFile}`, { encoding: 'utf-8' });
        fail('Should have thrown an error');
      } catch (error: any) {
        // Invalid JSON is caught during parsing, which is treated as ENGINE_ERROR (2)
        expect(error.status).toBeGreaterThan(0);
        expect(error.stderr.toString()).toContain('Invalid JSON');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    test('should reject bundle with missing required fields', () => {
      const invalidBundle = {
        bundleId: 'test',
        // Missing claim, thresholdPct, dataSpecs
      };
      const tempFile = path.join(__dirname, 'temp-incomplete.json');
      fs.writeFileSync(tempFile, JSON.stringify(invalidBundle));

      try {
        execSync(`node ${CLI_PATH} validate ${tempFile}`, { encoding: 'utf-8' });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(1); // INVALID_BUNDLE
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    test('should accept valid bundle structure', () => {
      const validBundle = {
        bundleId: 'test-001',
        claim: 'Test claim',
        thresholdPct: 0.05,
        dataSpecs: [
          {
            id: 'source-a',
            label: 'Source A',
            sourceKind: 'metric',
            originDocIds: ['doc-a'],
            metrics: [{ key: 'value', value: 100 }]
          },
          {
            id: 'source-b',
            label: 'Source B',
            sourceKind: 'metric',
            originDocIds: ['doc-b'],
            metrics: [{ key: 'value', value: 102 }]
          }
        ]
      };
      const tempFile = path.join(__dirname, 'temp-valid.json');
      fs.writeFileSync(tempFile, JSON.stringify(validBundle));

      try {
        const output = execSync(`node ${CLI_PATH} validate ${tempFile} --quiet`, {
          encoding: 'utf-8'
        });
        const result = JSON.parse(output);
        expect(result.valid).toBe(true);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Run Command', () => {
    const validBundle = {
      bundleId: 'test-run-001',
      claim: 'Test run command',
      thresholdPct: 0.05,
      dataSpecs: [
        {
          id: 'source-a',
          label: 'Source A',
          sourceKind: 'metric',
          originDocIds: ['doc-a'],
          metrics: [{ key: 'value', value: 100 }]
        },
        {
          id: 'source-b',
          label: 'Source B',
          sourceKind: 'metric',
          originDocIds: ['doc-b'],
          metrics: [{ key: 'value', value: 102 }]
        }
      ]
    };

    test('should generate receipt from valid bundle', () => {
      const tempFile = path.join(__dirname, 'temp-run.json');
      fs.writeFileSync(tempFile, JSON.stringify(validBundle));

      try {
        const output = execSync(`node ${CLI_PATH} run ${tempFile} --quiet`, {
          encoding: 'utf-8'
        });
        const receipt = JSON.parse(output);

        expect(receipt).toHaveProperty('bundleId', 'test-run-001');
        expect(receipt).toHaveProperty('deltaFinal');
        expect(receipt).toHaveProperty('sources');
        expect(receipt).toHaveProperty('rounds');
        expect(receipt).toHaveProperty('outcome');
        expect(receipt).toHaveProperty('hash');
        expect(receipt.sources).toEqual(['Source A', 'Source B']);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    test('should write receipt to output file', () => {
      const bundleFile = path.join(__dirname, 'temp-bundle-output.json');
      const receiptFile = path.join(__dirname, 'temp-receipt-output.json');
      fs.writeFileSync(bundleFile, JSON.stringify(validBundle));

      try {
        execSync(`node ${CLI_PATH} run ${bundleFile} --output ${receiptFile} --quiet`);

        expect(fs.existsSync(receiptFile)).toBe(true);

        const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf-8'));
        expect(receipt).toHaveProperty('hash');
      } finally {
        fs.unlinkSync(bundleFile);
        if (fs.existsSync(receiptFile)) {
          fs.unlinkSync(receiptFile);
        }
      }
    });

    test('should support pretty-print option', () => {
      const tempFile = path.join(__dirname, 'temp-pretty.json');
      fs.writeFileSync(tempFile, JSON.stringify(validBundle));

      try {
        const output = execSync(`node ${CLI_PATH} run ${tempFile} --pretty --quiet`, {
          encoding: 'utf-8'
        });

        // Pretty-printed JSON should have indentation
        expect(output).toContain('\n  ');
        expect(output).toContain('"bundleId"');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Verify Command', () => {
    test('should verify valid receipt', () => {
      // First generate a receipt
      const bundle = {
        bundleId: 'verify-test-001',
        claim: 'Test verify',
        thresholdPct: 0.05,
        dataSpecs: [
          {
            id: 'source-a',
            label: 'Source A',
            sourceKind: 'metric',
            originDocIds: ['doc-a'],
            metrics: [{ key: 'value', value: 100 }]
          },
          {
            id: 'source-b',
            label: 'Source B',
            sourceKind: 'metric',
            originDocIds: ['doc-b'],
            metrics: [{ key: 'value', value: 102 }]
          }
        ]
      };

      const bundleFile = path.join(__dirname, 'temp-verify-bundle.json');
      const receiptFile = path.join(__dirname, 'temp-verify-receipt.json');
      fs.writeFileSync(bundleFile, JSON.stringify(bundle));

      try {
        // Generate receipt
        execSync(`node ${CLI_PATH} run ${bundleFile} --output ${receiptFile} --quiet`);

        // Verify receipt
        const output = execSync(`node ${CLI_PATH} verify ${receiptFile} --quiet`, {
          encoding: 'utf-8'
        });
        const result = JSON.parse(output);

        expect(result.verified).toBe(true);
        expect(result.hash).toBeDefined();
      } finally {
        fs.unlinkSync(bundleFile);
        if (fs.existsSync(receiptFile)) {
          fs.unlinkSync(receiptFile);
        }
      }
    });

    test('should detect tampered receipt', () => {
      // First generate a valid receipt
      const bundle = {
        bundleId: 'tamper-test-001',
        claim: 'Test tampering',
        thresholdPct: 0.05,
        dataSpecs: [
          {
            id: 'source-a',
            label: 'Source A',
            sourceKind: 'metric',
            originDocIds: ['doc-a'],
            metrics: [{ key: 'value', value: 100 }]
          },
          {
            id: 'source-b',
            label: 'Source B',
            sourceKind: 'metric',
            originDocIds: ['doc-b'],
            metrics: [{ key: 'value', value: 102 }]
          }
        ]
      };

      const bundleFile = path.join(__dirname, 'temp-tamper-bundle.json');
      const receiptFile = path.join(__dirname, 'temp-tamper-receipt.json');
      fs.writeFileSync(bundleFile, JSON.stringify(bundle));

      try {
        // Generate receipt
        execSync(`node ${CLI_PATH} run ${bundleFile} --output ${receiptFile} --quiet`);

        // Tamper with receipt
        const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf-8'));
        receipt.outcome = 'tampered'; // Change outcome but keep hash
        fs.writeFileSync(receiptFile, JSON.stringify(receipt));

        // Verify should fail
        try {
          execSync(`node ${CLI_PATH} verify ${receiptFile} --quiet`);
          fail('Should have detected tampering');
        } catch (error: any) {
          expect(error.status).toBe(2); // ENGINE_ERROR
        }
      } finally {
        fs.unlinkSync(bundleFile);
        if (fs.existsSync(receiptFile)) {
          fs.unlinkSync(receiptFile);
        }
      }
    });
  });

  describe('Stdin Input', () => {
    test('should accept bundle from stdin', () => {
      const bundle = {
        bundleId: 'stdin-test-001',
        claim: 'Test stdin',
        thresholdPct: 0.05,
        dataSpecs: [
          {
            id: 'source-a',
            label: 'Source A',
            sourceKind: 'metric',
            originDocIds: ['doc-a'],
            metrics: [{ key: 'value', value: 100 }]
          },
          {
            id: 'source-b',
            label: 'Source B',
            sourceKind: 'metric',
            originDocIds: ['doc-b'],
            metrics: [{ key: 'value', value: 102 }]
          }
        ]
      };

      const output = execSync(`echo '${JSON.stringify(bundle)}' | node ${CLI_PATH} run --quiet`, {
        encoding: 'utf-8',
        shell: '/bin/bash'
      });

      const receipt = JSON.parse(output);
      expect(receipt).toHaveProperty('bundleId', 'stdin-test-001');
      expect(receipt).toHaveProperty('hash');
    });
  });

  describe('Exit Codes', () => {
    test('should return 0 on success', () => {
      const bundle = {
        bundleId: 'exit-test-001',
        claim: 'Test exit code',
        thresholdPct: 0.05,
        dataSpecs: [
          {
            id: 'source-a',
            label: 'Source A',
            sourceKind: 'metric',
            originDocIds: ['doc-a'],
            metrics: [{ key: 'value', value: 100 }]
          },
          {
            id: 'source-b',
            label: 'Source B',
            sourceKind: 'metric',
            originDocIds: ['doc-b'],
            metrics: [{ key: 'value', value: 102 }]
          }
        ]
      };

      const tempFile = path.join(__dirname, 'temp-exit-success.json');
      fs.writeFileSync(tempFile, JSON.stringify(bundle));

      try {
        const result = execSync(`node ${CLI_PATH} run ${tempFile} --quiet; echo $?`, {
          encoding: 'utf-8',
          shell: '/bin/bash'
        });

        // Last line should be exit code 0
        expect(result.trim().endsWith('0')).toBe(true);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    test('should return 1 for invalid bundle', () => {
      const invalidBundle = { bundleId: 'test' }; // Missing required fields

      const tempFile = path.join(__dirname, 'temp-exit-invalid.json');
      fs.writeFileSync(tempFile, JSON.stringify(invalidBundle));

      try {
        execSync(`node ${CLI_PATH} validate ${tempFile}`, { encoding: 'utf-8' });
        fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.status).toBe(1);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    test('should return 3 for file not found', () => {
      try {
        execSync(`node ${CLI_PATH} run nonexistent-file.json`, { encoding: 'utf-8' });
        fail('Should have exited with code 3');
      } catch (error: any) {
        expect(error.status).toBe(3);
      }
    });
  });
});
