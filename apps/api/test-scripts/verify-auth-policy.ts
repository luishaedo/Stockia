import { assertAuthPolicyCoverage } from '../src/config/authPolicy.js';

try {
    assertAuthPolicyCoverage();
    console.log('Auth policy coverage check passed.');
} catch (error) {
    console.error('Auth policy coverage check failed.');
    console.error(error);
    process.exit(1);
}
