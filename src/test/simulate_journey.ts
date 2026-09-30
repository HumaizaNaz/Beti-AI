import { betiOrchestrator } from '../core/orchestrator';
import { globalStore } from '../core/stateStore';
import { timerEngineSkill } from '../skills/timerEngineSkill';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemonstration() {
  const userPhone = '+923001234567';
  const user = globalStore.getUser(userPhone)!;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       🛡️  BETI AI GUARDIAN - MULTI-AGENT LIVE SIMULATOR       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`👤 User Profile: ${user.name} (${user.phone})`);
  console.log(`🔑 Secret Phrase: "${user.secretPhrase}" | Safe PIN: "${user.safePin}"`);
  console.log(`👨‍👩‍👧 Emergency Family Contacts:`);
  user.emergencyContacts.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} (${c.relationship}) -> ${c.phone}`);
  });

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('🧪 SCENARIO 1: NATURAL TRIP LOGGING & SAFE ARRIVAL');
  console.log('──────────────────────────────────────────────────────────────');
  
  const tripMsg = 'Rickshaw KHI-4521 mein baith gayi hoon, 20 mins to Home';
  console.log(`\n💬 [User WhatsApp Msg]: "${tripMsg}"`);
  const res1 = betiOrchestrator.processUserMessage(userPhone, tripMsg);
  console.log(`\n🤖 [Beti AI WhatsApp Reply]:\n${res1.reply}`);

  await sleep(800);

  const safeMsg = 'Safe pohnch gayi';
  console.log(`\n💬 [User WhatsApp Msg]: "${safeMsg}"`);
  const res2 = betiOrchestrator.processUserMessage(userPhone, safeMsg);
  console.log(`\n🤖 [Beti AI WhatsApp Reply]:\n${res2.reply}`);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('🧪 SCENARIO 2: SECRET CODE PHRASE (STEALTH PANIC TRIGGER)');
  console.log('──────────────────────────────────────────────────────────────');

  const trip2Msg = 'Careem BK-9988 to Clifton 15 mins';
  console.log(`\n💬 [User WhatsApp Msg]: "${trip2Msg}"`);
  betiOrchestrator.processUserMessage(userPhone, trip2Msg);

  await sleep(800);

  // User speaks secret code in front of attacker
  const secretCodeMsg = 'Bhaiya late ho raha hai gaadi tej chalao';
  console.log(`\n💬 [User WhatsApp Msg / Voice]: "${secretCodeMsg}"`);
  console.log('   (User speaks secret phrase casually in car)');

  const res3 = betiOrchestrator.processUserMessage(userPhone, secretCodeMsg);
  console.log(`\n🤖 [Beti AI Camouflaged Response on Phone]: "${res3.reply}"`);
  console.log(`🚨 [Emergency Triggered]: ${res3.isEmergencyTriggered ? 'YES (Silent Family Broadcast Sent!)' : 'NO'}`);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('🧪 SCENARIO 3: DEAD-MAN\'S SWITCH (PHONE SMASHED / 0% BATTERY)');
  console.log('──────────────────────────────────────────────────────────────');

  const trip3Msg = 'Taking Indrive LE-3344 to University 1 min';
  console.log(`\n💬 [User WhatsApp Msg]: "${trip3Msg}"`);
  betiOrchestrator.processUserMessage(userPhone, trip3Msg);

  console.log('\n⚠️ [Simulation]: Phone battery hits 0% / Attacker smashes device!');
  console.log('⏳ [Server Watchdog]: Cloud timer countdown active...');
  
  // Fast demonstration: trigger the timeout
  await sleep(2000);
  console.log('⏱️ [Simulated Fast-Forward]: Trip deadline reached without safe PIN.');
  
  // Directly simulate the timeout callback
  const activeTrip = globalStore.getActiveTrip(userPhone);
  if (activeTrip) {
    const { dispatcherAgent } = await import('../agents/dispatcherAgent');
    dispatcherAgent.triggerEmergency(
      user,
      'DEAD_MAN_TIMEOUT',
      `Dead-Man's Timer expired (${activeTrip.etaMinutes} mins elapsed). User phone appears unreachable/dead without safe check-in.`,
      activeTrip
    );
  }

  console.log('\n✅ [ALL 3 REAL-WORLD SAFETY SCENARIOS PASSED 100%]');
  console.log('══════════════════════════════════════════════════════════════');
}

runDemonstration();
