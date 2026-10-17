# Online Charging System (OCS) and Convergent Charging Guide

## What is an OCS
An Online Charging System performs real-time rating, balance management and credit control for prepaid and hybrid telecom services (voice, SMS, data, VAS). It authorizes usage *before* it is delivered and deducts balance in real time. Offline charging (OFCS/billing mediation) processes CDRs after usage for postpaid billing. A Converged Charging System (CCS) combines both.

## 3GPP Charging Architecture
- **CTF (Charging Trigger Function)**: network elements (PGW/GGSN, SMSC, MSC/IMS, SMF/UPF in 5G) that detect chargeable events.
- **CTF to OCS interface = Diameter Gy** (Credit-Control, RFC 4006 / TS 32.299). In 5G the interface is the **Nchf** service-based interface (CHF = Charging Function).
- **PCRF/PCF** uses **Diameter Gx / Npcf** for policy control; **Sy** shares spending limits between OCS and PCRF.
- **Ro** is the Diameter online charging interface for IMS (voice/SMS). **Rf/Gz** are offline charging interfaces. **Ga** transfers CDRs to the Billing Domain.
- **CAP (CAMEL Application Part)** and **INAP** are legacy SS7 online charging protocols for voice/SMS. **SMPP/Diameter** for SMS.

## Diameter Credit-Control (DCCA) Flow
Credit-Control-Request (CCR) types: **INITIAL** (session start, reserve quota), **UPDATE** (quota exhausted/thresholds/events), **TERMINATION** (session end, final usage), **EVENT** (one-shot, e.g. SMS).
1. NE sends CCR-Initial with Subscription-Id (MSISDN/IMSI), Service-Context-Id, Requested-Service-Unit.
2. OCS rates the request, checks balance, reserves units and answers CCA with **Granted-Service-Unit**, **Validity-Time**, **Final-Unit-Indication** and Result-Code.
3. NE delivers service, sends CCR-Update when granted units are consumed; OCS commits used units and reserves more.
4. CCR-Termination reports final usage; OCS releases unused reservation.
- Key result codes: **2001** DIAMETER_SUCCESS, **4012** CREDIT_LIMIT_REACHED, **4010** END_USER_SERVICE_DENIED, **5030** USER_UNKNOWN, **3002** UNABLE_TO_DELIVER, **5012** UNABLE_TO_COMPLY.
- Key AVPs: Session-Id, CC-Request-Type, CC-Request-Number, Rating-Group, Service-Identifier, Used-Service-Unit (CC-Total-Octets, CC-Time), Multiple-Services-Credit-Control.
- **Final-Unit-Indication actions**: TERMINATE, REDIRECT (to top-up portal), RESTRICT_ACCESS.

## OCS Core Functions
- **Account Balance Management (ABMF)**: balances (monetary, data MB, minutes, SMS), expiry, buckets, priority and consumption order.
- **Rating Function (RF)**: tariff plans, rate tables, time-of-day/day-type, location (zone), roaming, tiered/volume/threshold rating, rounding and minimum charge.
- **Session-Based Charging Function (SBCF)**: quota reservation, multiple concurrent sessions, reservation timeouts.
- **Event-Based Charging Function (EBCF)**: one-time events (SMS, MMS, content purchase, top-up).
- **Product/Offer catalogue**: bundles, add-ons, recurring charges (daily/weekly/monthly), one-off fees, promotions, loyalty points, free units.
- **Top-up / Recharge**: voucher, scratch card, e-wallet, bank, retailer channels; **balance transfer**, **loan/credit-me**, **auto-renewal**.
- **Notifications**: low balance, expiry, usage threshold (80/100%) via SMS/USSD/push.
- **Fraud and limits**: spending limits, daily caps, velocity checks.

## Prepaid vs Postpaid vs Hybrid
- Prepaid: pay first, real-time deduction, service stops at zero balance.
- Postpaid: usage accumulates, invoiced per bill cycle, credit limit enforced; may still use OCS for real-time credit limit control.
- Hybrid/Convergent: one balance/offer platform for both, shared bundles for family/enterprise.

## Mediation and Billing
- **Mediation** collects, normalizes, de-duplicates and correlates CDRs from network elements and forwards them to rating/billing.
- **Rated CDRs/EDRs** feed the billing system for invoicing, revenue assurance and reconciliation.
- Typical pipeline: Network -> OCS/CGF -> Mediation -> Billing -> GL/ERP; CRM drives customer, product and payment data.

## Typical OCS Vendors and Platforms
Huawei CBS/Convergent Billing, Ericsson Charging System, Oracle BRM / OCC, Nokia, Amdocs Charging, Optiva (BSS), Comviva, Redknee, Netcracker, plus open-source Diameter stacks such as jDiameter, FreeDiameter and CGRateS.

## Troubleshooting Charging Issues
- **Subscriber has balance but service denied**: check account state (active/suspended/expired), correct offer/rating group, 4012/4010 in CCA, Diameter peer state, tariff mapping for Rating-Group/Service-Identifier.
- **Wrong deduction**: verify rate plan, time-of-day band, rounding rules, bucket priority, roaming zone and unit conversion (bytes vs KB vs MB).
- **Double charging**: duplicate CCR-Update/retransmission (check CC-Request-Number, Session-Id idempotency), stuck reservations, both online and offline charging applied.
- **Free usage / revenue leakage**: Final-Unit-Indication ignored, session cache timeouts, missing CCR-Termination, unmatched rating group, CDRs lost in mediation.
- **Diameter timeouts (Tx timer)**: check DWR/DWA watchdog, peer connectivity (SCTP/TCP port 3868), OCS CPU/TPS saturation, database latency; configure failover/credit-control-failure-handling (CONTINUE / TERMINATE / RETRY_AND_TERMINATE).
- **Balance not updated after top-up**: verify voucher status, recharge logs, event queue backlog, cache vs database consistency, notification delivery separate from balance update.
- **Performance**: size for peak TPS, use in-memory grids (Redis/Hazelcast/Coherence) for balances, partition subscribers by hash, horizontally scale rating nodes, monitor CCR latency (target typically < 50 ms) and error rate.

## Charging on Docker/Kubernetes
Package each charging component (Diameter gateway, rating engine, balance service, notification service) as its own container. Run stateless rating/Diameter pods as Deployments behind a Service with SCTP/TCP 3868 exposed through a LoadBalancer or NodePort, keep balance stores in StatefulSets, and scale with an HPA on CPU or CCR rate. Use readiness probes tied to Diameter peer state and PodDisruptionBudgets to keep charging available during upgrades.
