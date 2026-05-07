/**
 * Aggregator ID Assignment Service
 * 
 * This service provides intelligent aggregator ID assignment that fills gaps
 * in the ID sequence before incrementing to higher numbers.
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (!firebaseInitialized) {
    const serviceAccountPath = path.resolve(__dirname, '../../../serviceAccountKey.json.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });
    firebaseInitialized = true;
  }
  return admin.firestore();
}

/**
 * Result of ID discovery operation
 */
export interface IdDiscoveryResult {
  gaps: number[];           // Sorted array of gap IDs [3, 7, 12]
  nextSequential: number;   // Next ID after highest assigned
}

/**
 * Service interface for aggregator ID assignment
 */
export interface AggregatorIdService {
  assignAggregatorId(userId: string): Promise<string>;
}

/**
 * Parse an aggregator ID string to its numeric value
 * 
 * @param id - Aggregator ID string (e.g., "001", "042", "256")
 * @returns Numeric value or null if invalid
 */
export function parseAggregatorId(id: string): number | null {
  // Handle empty string
  if (!id || id.trim() === '') {
    return null;
  }

  // Check if string contains only digits
  if (!/^\d+$/.test(id)) {
    return null;
  }

  // Parse to number
  const numericValue = parseInt(id, 10);

  // Validate the parsed number (must be positive)
  if (isNaN(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

/**
 * Format a numeric ID as a zero-padded string
 * 
 * @param numericId - Numeric ID value
 * @returns Zero-padded string (e.g., 1 -> "001", 42 -> "042", 256 -> "256")
 */
export function formatAggregatorId(numericId: number): string {
  return numericId.toString().padStart(3, '0');
}

/**
 * Validate aggregator ID format
 * 
 * Validates: Requirements 4.1, 5.3
 * 
 * @param id - Aggregator ID string to validate
 * @returns True if valid format (matches /^\d{3,}$/ pattern)
 */
export function isValidAggregatorId(id: string): boolean {
  // Validate format: three or more digits
  return /^\d{3,}$/.test(id);
}

/**
 * Find available aggregator IDs (gaps and next sequential)
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.3
 * 
 * @returns Object containing gaps array and next sequential ID
 */
export async function findAvailableIds(): Promise<IdDiscoveryResult> {
  const db = initializeFirebase();
  
  // Query Firestore users collection for all users with role='AGGREGATOR'
  const usersSnapshot = await db.collection('users')
    .where('role', '==', 'AGGREGATOR')
    .get();
  
  // Extract and parse aggregatorId field from each document
  const assignedIds: number[] = [];
  
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const aggregatorId = data.aggregatorId;
    
    // Filter out null/empty/invalid IDs
    if (aggregatorId && typeof aggregatorId === 'string') {
      const numericId = parseAggregatorId(aggregatorId);
      if (numericId !== null) {
        assignedIds.push(numericId);
      }
    }
  }
  
  // Handle empty system case
  if (assignedIds.length === 0) {
    return {
      gaps: [],
      nextSequential: 1
    };
  }
  
  // Find max ID in the set
  const maxId = Math.max(...assignedIds);
  
  // Create a set of assigned IDs for O(1) lookup
  const assignedSet = new Set(assignedIds);
  
  // Calculate gaps in the sequence [1..max]
  const gaps: number[] = [];
  for (let i = 1; i <= maxId; i++) {
    if (!assignedSet.has(i)) {
      gaps.push(i);
    }
  }
  
  // Calculate nextSequential as max + 1
  const nextSequential = maxId + 1;
  
  return {
    gaps,
    nextSequential
  };
}

/**
 * Select the next ID to assign based on gaps and sequential ID
 * 
 * Validates: Requirements 2.1, 2.2, 6.1
 * 
 * @param gaps - Sorted array of available gap IDs
 * @param nextSequential - Next sequential ID after highest assigned
 * @returns The ID to assign (lowest gap, or nextSequential, or 1)
 */
export function selectNextId(gaps: number[], nextSequential: number): number {
  // If gaps exist, return the lowest gap (first element since gaps are sorted)
  // Note: In valid scenarios from findAvailableIds, gaps are always < nextSequential
  if (gaps && gaps.length > 0) {
    return gaps[0];
  }
  
  // If nextSequential is valid (positive number), return it
  if (nextSequential && nextSequential > 0) {
    return nextSequential;
  }
  
  // Edge case: both gaps and nextSequential are empty/invalid
  // This happens when the system is empty or in an invalid state
  return 1;
}

/**
 * Assign an aggregator ID to a user in Firestore
 * 
 * @param userId - User document ID
 * @param aggregatorId - Aggregator ID to assign
 * @param maxRetries - Maximum retry attempts on conflict
 * @throws Error if user not found, already has ID, or assignment fails after retries
 */
export async function assignIdToUser(
  userId: string,
  aggregatorId: string,
  maxRetries: number = 3
): Promise<void> {
  const db = initializeFirebase();
  const userRef = db.collection('users').doc(userId);
  
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Read current user document
      const userDoc = await userRef.get();
      
      // Verify user exists
      if (!userDoc.exists) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      const userData = userDoc.data();
      
      // Verify aggregatorId field is null/empty (not already assigned)
      if (userData?.aggregatorId && userData.aggregatorId.trim() !== '') {
        throw new Error(`User ${userId} already has aggregator ID: ${userData.aggregatorId}`);
      }
      
      // Attempt to write aggregatorId using Firestore update
      // This is a simple update without transaction - conflicts will be detected on retry
      await userRef.update({
        aggregatorId: aggregatorId
      });
      
      // Success - exit the retry loop
      return;
      
    } catch (error: any) {
      attempt++;
      
      // Check if this is a retryable error (concurrency conflict)
      // Firestore update conflicts typically manifest as version mismatches
      // For this implementation, we'll retry on any error except:
      // - User not found (non-retryable)
      // - User already has ID (non-retryable)
      const isNonRetryable = 
        error.message?.includes('not found') ||
        error.message?.includes('already has aggregator ID');
      
      if (isNonRetryable) {
        // Non-retryable error - throw immediately
        throw error;
      }
      
      if (attempt >= maxRetries) {
        // Max retries reached - throw with descriptive error
        throw new Error(
          `Failed to assign aggregator ID ${aggregatorId} to user ${userId} after ${maxRetries} attempts: ${error.message}`
        );
      }
      
      // Retryable error - continue to next attempt
      // Add a small delay to reduce contention
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
  
  // Should never reach here due to throw in loop, but TypeScript needs this
  throw new Error(`Failed to assign aggregator ID after ${maxRetries} attempts`);
}

/**
 * Main service function: Assign aggregator ID to a user
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.2, 7.1, 7.3
 * 
 * @param userId - User document ID
 * @returns Assigned aggregator ID
 * @throws Error if assignment fails after retries
 */
export async function assignAggregatorId(userId: string): Promise<string> {
  try {
    // Step 1: Find available IDs (gaps and next sequential)
    const { gaps, nextSequential } = await findAvailableIds();
    
    // Step 2: Select the next ID to assign (lowest gap or next sequential)
    const numericId = selectNextId(gaps, nextSequential);
    
    // Step 3: Format the numeric ID as a zero-padded string
    const aggregatorId = formatAggregatorId(numericId);
    
    // Step 4: Assign the ID to the user with retry logic
    await assignIdToUser(userId, aggregatorId);
    
    // Step 5: Log successful assignment with timestamp, userId, and assigned ID
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] AggregatorID: Assigned ID "${aggregatorId}" to user "${userId}" (success)`);
    
    // Step 6: Return the assigned aggregator ID
    return aggregatorId;
    
  } catch (error: any) {
    // Log failure with error details
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] AggregatorID: Failed to assign ID to user "${userId}" (error: ${error.message})`);
    
    // Re-throw the error for the caller to handle
    throw error;
  }
}
