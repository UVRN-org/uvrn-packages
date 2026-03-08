/**
 * Basic Usage Example - Delta Engine SDK
 *
 * This example demonstrates how to:
 * 1. Create a DeltaEngineClient in local mode
 * 2. Build a bundle using BundleBuilder
 * 3. Execute the bundle and receive a receipt
 */

import { DeltaEngineClient, BundleBuilder } from '@uvrn/sdk';

async function main() {
  console.log('=== Delta Engine SDK - Basic Usage Example ===\n');

  // Step 1: Create a client in local mode
  console.log('1. Creating client in local mode...');
  const client = new DeltaEngineClient({
    mode: 'local'
  });

  // Step 2: Build a bundle
  console.log('2. Building bundle...');
  const bundle = new BundleBuilder()
    .setClaim('Q1 2024 revenue matches forecast within 5%')
    .addDataSpecQuick(
      'forecast',
      'Q1 2024 Revenue Forecast',
      'report',
      ['forecast-doc-2024-q1'],
      [
        { key: 'revenue', value: 1000000, unit: 'USD' },
        { key: 'expenses', value: 750000, unit: 'USD' }
      ]
    )
    .addDataSpecQuick(
      'actual',
      'Q1 2024 Revenue Actual',
      'report',
      ['actuals-doc-2024-q1'],
      [
        { key: 'revenue', value: 1020000, unit: 'USD' },
        { key: 'expenses', value: 765000, unit: 'USD' }
      ]
    )
    .setThreshold(0.05) // 5% threshold
    .setMaxRounds(5)
    .build();

  console.log('   Bundle ID:', bundle.bundleId);
  console.log('   Claim:', bundle.claim);
  console.log('   Data Sources:', bundle.dataSpecs.length);
  console.log('   Threshold:', (bundle.thresholdPct * 100) + '%');
  console.log();

  // Step 3: Execute the bundle
  console.log('3. Executing bundle...');
  const receipt = await client.runEngine(bundle);

  // Step 4: Display results
  console.log('4. Results:');
  console.log('   Outcome:', receipt.outcome);
  console.log('   Final Delta:', receipt.deltaFinal);
  console.log('   Rounds:', receipt.rounds.length);
  console.log('   Receipt Hash:', receipt.hash);
  console.log();

  // Step 5: Show round details
  console.log('5. Round Details:');
  receipt.rounds.forEach((round, index) => {
    console.log(`   Round ${round.round}:`);
    console.log(`     Within Threshold: ${round.withinThreshold}`);
    console.log(`     Witness Required: ${round.witnessRequired}`);
    console.log(`     Deltas:`, round.deltasByMetric);
  });
  console.log();

  // Step 6: Verify receipt
  console.log('6. Verifying receipt...');
  const verification = await client.verifyReceipt(receipt);
  console.log('   Verified:', verification.verified ? '✓' : '✗');
  console.log('   Deterministic:', verification.deterministic ? '✓' : '✗');
  console.log();

  if (receipt.outcome === 'consensus') {
    console.log('✓ SUCCESS: Consensus reached!');
  } else {
    console.log('⚠ Indeterminate outcome - delta exceeded threshold');
  }
}

// Run the example
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
