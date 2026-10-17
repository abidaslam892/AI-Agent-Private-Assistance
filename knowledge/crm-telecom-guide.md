# Telecom CRM and BSS Guide

## What the CRM Does in Telecom
The Customer Relationship Management (CRM) system is the front-office hub of the BSS (Business Support Systems). It stores the customer 360 view and drives customer lifecycle processes, integrating with OCS/charging, billing, order management, provisioning, payment gateways and the self-care app.

## Core CRM Modules
- **Customer and Account Management**: individual/corporate customers, KYC and identity documents, hierarchies (parent/child accounts), contact preferences, credit class.
- **Subscriber and Subscription Management**: MSISDN, IMSI, SIM/ICCID, plan, status (Active, Suspended, Barred, Terminated), activation and number porting (MNP).
- **Product Catalog**: plans, bundles, add-ons, pricing, eligibility rules and promotions (shared with OCS offer catalog).
- **Order Management**: new connection, plan change, add-on purchase, SIM swap, suspend/resume, disconnect. Orders are decomposed into provisioning tasks sent to OCS, HLR/HSS/UDM, PCRF and network.
- **Billing and Payments**: invoices, payment collection, dunning, adjustments, refunds, credit notes, disputes.
- **Customer Care and Ticketing**: case/ticket lifecycle, SLA, escalation, knowledge base, contact center (IVR, chat, WhatsApp, social).
- **Campaign and Marketing**: segmentation, next-best-offer, churn prevention, loyalty.
- **Self-care channels**: mobile app, web portal, USSD, retailer/dealer portal.

## Typical Order-to-Activate Flow
1. Customer selects an offer in CRM/portal (catalog validation, credit check, KYC).
2. CRM creates the order and subscriber record.
3. Order orchestration (OSS/provisioning) allocates MSISDN and SIM, provisions HLR/HSS, PCRF and creates the account and offer instance in the OCS.
4. OCS applies initial balance/bundle; CRM status becomes Active; welcome notification is sent.
5. Billing account is created for postpaid customers.

## CRM <-> OCS Integration
- Interfaces: REST/SOAP web services, TMF Open APIs (TMF620 Product Catalog, TMF622 Product Ordering, TMF629 Customer Management, TMF666 Account, TMF678 Customer Bill), message queues (Kafka/MQ), SFTP batch.
- Typical synchronization: subscriber create/update, offer subscribe/unsubscribe, balance query, recharge, status change (suspend/barred), SIM swap, plan migration.
- CRM is the system of record for customer data; the OCS is the system of record for balances and real-time usage. Reconcile regularly to avoid mismatches.

## Common Customer Issues and Resolution
- **Customer cannot browse after recharge**: confirm recharge posted in OCS, balance/bundle active, subscriber status Active in both CRM and OCS, APN/data profile provisioned, PCRF session.
- **Offer purchased but not activated**: check order status in CRM, failed provisioning task, retry from the order queue, confirm OCS offer instance.
- **Status mismatch (CRM Active, OCS Suspended)**: re-sync subscriber state through the integration, check failed messages in the queue/dead letter queue.
- **Wrong bill amount**: review usage CDRs, rating plan at time of usage, recurring charges, adjustments, proration on plan change.
- **SIM swap issues**: verify new ICCID/IMSI mapped in CRM, HLR/HSS and OCS, old SIM barred.
- **Duplicate customers**: use MSISDN/ID-based deduplication and merge procedures.

## KPIs
ARPU, churn rate, first-call resolution, average handle time, NPS/CSAT, order fulfilment time, activation success rate, collections/DSO.

## Deploying CRM/BSS on Docker and Kubernetes
Run CRM web/API tiers as Deployments with multiple replicas and ingress, store sessions in Redis, use managed or StatefulSet PostgreSQL/Oracle for data, publish integration events through Kafka, keep configuration in ConfigMaps and credentials in Secrets, and use readiness probes plus rolling updates for zero-downtime releases.
