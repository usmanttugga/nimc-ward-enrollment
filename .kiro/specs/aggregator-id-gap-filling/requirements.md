# Requirements Document

## Introduction

This document specifies the requirements for an intelligent aggregator ID assignment system. Currently, aggregators are assigned IDs manually (e.g., 004, 005, 008), which can result in gaps in the sequence. The new system will automatically assign the lowest available ID number, filling gaps before incrementing to higher numbers. This ensures efficient use of the ID space and maintains a compact, sequential numbering system.

## Glossary

- **ID_Assignment_Service**: The service responsible for generating and assigning unique aggregator IDs
- **Aggregator**: A user with the role of aggregator who manages multiple agents
- **Aggregator_ID**: A three-digit zero-padded numeric identifier (e.g., "001", "008", "042")
- **Gap**: A missing ID number in the sequence of assigned aggregator IDs
- **ID_Sequence**: The ordered list of all assigned aggregator IDs
- **Firestore_Users_Collection**: The Firestore database collection storing user documents

## Requirements

### Requirement 1: Identify Available IDs

**User Story:** As the system, I want to identify all available aggregator IDs, so that I can assign the lowest available number to new aggregators.

#### Acceptance Criteria

1. WHEN the ID_Assignment_Service is invoked, THE ID_Assignment_Service SHALL retrieve all existing Aggregator_IDs from the Firestore_Users_Collection
2. THE ID_Assignment_Service SHALL parse each Aggregator_ID into its numeric value
3. THE ID_Assignment_Service SHALL identify all unassigned ID numbers between 1 and the highest assigned ID number
4. THE ID_Assignment_Service SHALL identify the next sequential ID number after the highest assigned ID

### Requirement 2: Assign Lowest Available Gap ID

**User Story:** As an administrator, I want new aggregators to receive the lowest available ID number, so that the ID sequence remains compact and gaps are filled.

#### Acceptance Criteria

1. WHEN a new Aggregator registers AND gaps exist in the ID_Sequence, THE ID_Assignment_Service SHALL assign the lowest available gap number
2. WHEN a new Aggregator registers AND no gaps exist in the ID_Sequence, THE ID_Assignment_Service SHALL assign the next sequential number after the highest assigned ID
3. THE ID_Assignment_Service SHALL format the assigned number as a three-digit zero-padded string
4. THE ID_Assignment_Service SHALL store the assigned Aggregator_ID in the Firestore_Users_Collection

### Requirement 3: Handle Concurrent ID Assignment

**User Story:** As the system, I want to prevent duplicate ID assignment when multiple aggregators register simultaneously, so that each aggregator receives a unique ID.

#### Acceptance Criteria

1. WHEN multiple Aggregators register concurrently, THE ID_Assignment_Service SHALL ensure each receives a unique Aggregator_ID
2. IF an ID assignment operation detects a conflict, THEN THE ID_Assignment_Service SHALL retry with the next available ID
3. THE ID_Assignment_Service SHALL complete the assignment operation within 5 seconds under normal load conditions

### Requirement 4: Validate ID Format

**User Story:** As a developer, I want all aggregator IDs to follow a consistent format, so that the system remains predictable and maintainable.

#### Acceptance Criteria

1. THE ID_Assignment_Service SHALL generate Aggregator_IDs as three-digit zero-padded strings
2. WHEN the assigned number is less than 10, THE ID_Assignment_Service SHALL format it with two leading zeros (e.g., "001", "007")
3. WHEN the assigned number is between 10 and 99, THE ID_Assignment_Service SHALL format it with one leading zero (e.g., "042", "099")
4. WHEN the assigned number is 100 or greater, THE ID_Assignment_Service SHALL format it without leading zeros (e.g., "100", "256")

### Requirement 5: Preserve Existing IDs

**User Story:** As an administrator, I want existing aggregator IDs to remain unchanged, so that historical records and references remain valid.

#### Acceptance Criteria

1. THE ID_Assignment_Service SHALL NOT modify existing Aggregator_IDs
2. WHEN calculating available IDs, THE ID_Assignment_Service SHALL treat all existing Aggregator_IDs as reserved
3. THE ID_Assignment_Service SHALL support existing Aggregator_IDs in any valid format

### Requirement 6: Handle Edge Cases

**User Story:** As a developer, I want the system to handle edge cases gracefully, so that ID assignment remains reliable under all conditions.

#### Acceptance Criteria

1. WHEN no Aggregators exist in the system, THE ID_Assignment_Service SHALL assign "001" as the first Aggregator_ID
2. WHEN the Firestore_Users_Collection is empty, THE ID_Assignment_Service SHALL assign "001" as the first Aggregator_ID
3. IF an Aggregator document has a null or empty Aggregator_ID field, THEN THE ID_Assignment_Service SHALL exclude it from the ID_Sequence calculation
4. WHEN parsing Aggregator_IDs, THE ID_Assignment_Service SHALL handle both zero-padded and non-zero-padded numeric strings

### Requirement 7: Provide ID Assignment Feedback

**User Story:** As an administrator, I want to see which ID was assigned to a new aggregator, so that I can verify the assignment was successful.

#### Acceptance Criteria

1. WHEN an Aggregator_ID is assigned, THE ID_Assignment_Service SHALL return the assigned ID to the caller
2. IF the assignment operation fails, THEN THE ID_Assignment_Service SHALL return a descriptive error message
3. THE ID_Assignment_Service SHALL log each ID assignment operation with the assigned ID and timestamp
