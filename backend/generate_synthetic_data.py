import os
import json
import random
import datetime
import networkx as nx
from faker import Faker
import pandas as pd

# Deterministic seed for crisp, perfectly clustered presentation network
random.seed(101)
fake = Faker('en_IN')
Faker.seed(101)

NUM_CLUSTERS = 3
CLUSTER_NAMES = [
    "Cyber Hawala Core (Delhi-NCR)",
    "Financial Mule Logistics (Mumbai)",
    "Telecom Routing Syndicate (Bengaluru)"
]
CLUSTER_SIZE_RANGE = (5, 7)

TOWER_LOCATIONS = [
    "Delhi-Central-Cell-102",
    "Noida-Sector62-Tower-4",
    "Gurugram-CyberCity-Relay-12",
    "Mumbai-South-Bandra-08",
    "Bengaluru-Whitefield-Node-3"
]

REMARKS_NORMAL = [
    "Consultancy charges",
    "Vendor settlement",
    "Logistics advance",
    "Material procurement",
    "Hardware purchase"
]

REMARKS_SMURFING = [
    "Consulting Retainer Tranche A",
    "Consulting Retainer Tranche B",
    "Consulting Retainer Tranche C",
    "Material Delivery Milestone 1",
    "Emergency Operational Float"
]


def generate_ground_truth_network():
    G = nx.Graph()
    person_id = 0
    cluster_members = {}
    
    for cluster_id in range(NUM_CLUSTERS):
        size = random.randint(*CLUSTER_SIZE_RANGE)
        members = []
        for idx in range(size):
            name = fake.name()
            clean_tokens = [t for t in name.split() if not t.endswith(".") or len(t) > 3]
            if len(clean_tokens) >= 2:
                first, last = clean_tokens[0], clean_tokens[-1]
            else:
                first, last = name.split()[0], name.split()[-1]

            # Primary and alias forms
            aliases = list(set([
                name,
                f"{first} {last[0]}.",
                f"{first[0]}. {last}",
                f"{first} {last}".upper() if random.random() < 0.4 else f"{first} {last}"
            ]))

            phone = "98" + str(random.randint(10000000, 99999999))
            account = str(random.randint(10**9, 10**10 - 1))
            role = "Syndicate Lead" if idx == 0 else ("Financial Mule" if idx % 2 == 0 else "Hawala Courier")

            G.add_node(
                person_id,
                name=name,
                aliases=aliases,
                phone=phone,
                account=account,
                role=role,
                cluster=cluster_id,
                cluster_name=CLUSTER_NAMES[cluster_id]
            )
            members.append(person_id)
            person_id += 1

        # Dense internal communication and transfer edges
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                if random.random() < 0.65:
                    edge_type = random.choice(["call", "transfer", "both"])
                    G.add_edge(members[i], members[j], type=edge_type)
                    
        cluster_members[cluster_id] = members

    # Bridge links between cluster coordinators
    for c1, c2 in [(0, 1), (1, 2), (0, 2)]:
        u = random.choice(cluster_members[c1])
        v = random.choice(cluster_members[c2])
        if not G.has_edge(u, v):
            G.add_edge(u, v, type="both")

    return G, cluster_members


def build_and_save_dataset():
    print("[*] Generating tightly-knit criminal syndicate ground truth...")
    G, cluster_members = generate_ground_truth_network()
    
    nodes_data = {}
    for n, attrs in G.nodes(data=True):
        nodes_data[n] = attrs

    edges_data = []
    for u, v, attrs in G.edges(data=True):
        edges_data.append({
            "source": u,
            "target": v,
            "type": attrs.get("type", "call")
        })

    ground_truth = {
        "metadata": {
            "total_persons": G.number_of_nodes(),
            "total_relationships": G.number_of_edges(),
            "clusters": NUM_CLUSTERS,
            "generated_at": datetime.datetime.now().isoformat()
        },
        "nodes": nodes_data,
        "edges": edges_data
    }
    
    with open("ground_truth.json", "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)
    print(f"[+] Saved ground_truth.json ({G.number_of_nodes()} persons, {G.number_of_edges()} relationships)")

    # 1. Generate CDR_Logs.csv
    cdr_rows = []
    base_date = datetime.date(2026, 3, 1)

    for u, v, attrs in G.edges(data=True):
        etype = attrs.get("type", "call")
        if etype in ["call", "both"]:
            p1 = G.nodes[u]
            p2 = G.nodes[v]
            
            call_count = random.randint(2, 4)
            for _ in range(call_count):
                day_offset = random.randint(0, 14)
                call_date = (base_date + datetime.timedelta(days=day_offset)).strftime("%Y-%m-%d")
                hour = random.randint(8, 22)
                minute = random.randint(0, 59)
                sec = random.randint(0, 59)
                call_time = f"{hour:02d}:{minute:02d}:{sec:02d}"
                duration = random.randint(45, 600)
                tower = random.choice(TOWER_LOCATIONS)

                if random.random() < 0.5:
                    c_num, r_num = p1["phone"], p2["phone"]
                else:
                    c_num, r_num = p2["phone"], p1["phone"]

                cdr_rows.append({
                    "caller_number": c_num,
                    "receiver_number": r_num,
                    "call_date": call_date,
                    "call_time": call_time,
                    "duration_seconds": duration,
                    "tower_location": tower
                })

    df_cdr = pd.DataFrame(cdr_rows)
    df_cdr.to_csv("CDR_Logs.csv", index=False)
    print(f"[+] Saved CDR_Logs.csv ({len(df_cdr)} call events)")

    # 2. Generate Bank_Transactions.csv (Includes phone linkages & smurfing chains)
    bank_rows = []
    transfer_edges = [
        (u, v) for u, v, attrs in G.edges(data=True) if attrs.get("type") in ["transfer", "both"]
    ]

    # Select 2-3 specific edges for smurfing structuring loops
    smurfing_edges = set(random.sample(transfer_edges, min(3, len(transfer_edges))))

    for u, v in transfer_edges:
        p1 = G.nodes[u]
        p2 = G.nodes[v]
        
        s_name = random.choice(p1["aliases"])
        r_name = random.choice(p2["aliases"])
        s_acc = p1["account"]
        r_acc = p2["account"]
        s_phone = p1["phone"]
        r_phone = p2["phone"]

        if (u, v) in smurfing_edges:
            # 4-5 micro-transfers between Rs.49,100 and Rs.49,950 over 2 days
            burst_date = base_date + datetime.timedelta(days=random.randint(2, 8))
            for t_idx in range(4):
                tx_date = (burst_date + datetime.timedelta(days=t_idx % 2)).strftime("%Y-%m-%d")
                amt = random.randint(49150, 49920)
                remark = REMARKS_SMURFING[t_idx % len(REMARKS_SMURFING)]
                bank_rows.append({
                    "sender_name": s_name,
                    "sender_account": s_acc,
                    "sender_phone": s_phone,
                    "receiver_name": r_name,
                    "receiver_account": r_acc,
                    "receiver_phone": r_phone,
                    "amount_inr": amt,
                    "transaction_date": tx_date,
                    "remarks": remark
                })
        else:
            tx_date = (base_date + datetime.timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
            amt = random.choice([15000, 32000, 75000, 180000])
            remark = random.choice(REMARKS_NORMAL)
            bank_rows.append({
                "sender_name": s_name,
                "sender_account": s_acc,
                "sender_phone": s_phone,
                "receiver_name": r_name,
                "receiver_account": r_acc,
                "receiver_phone": r_phone,
                "amount_inr": amt,
                "transaction_date": tx_date,
                "remarks": remark
            })

    df_bank = pd.DataFrame(bank_rows)
    df_bank.to_csv("Bank_Transactions.csv", index=False)
    print(f"[+] Saved Bank_Transactions.csv ({len(df_bank)} records with phone linkages)")

    # 3. Generate Primary FIR
    c0 = cluster_members[0]
    c1 = cluster_members[1]
    suspect_1 = G.nodes[c0[0]]
    suspect_2 = G.nodes[c0[1]]
    assoc_1 = G.nodes[c1[0]]

    fir_content = f"""SPECIAL CELL / CRIME BRANCH FIRST INFORMATION REPORT (FIR)
FIR NO: 992/2026
POLICE STATION: CRIME BRANCH SOG, NEW DELHI
DATE: 2026-03-12 10:00 HRS
SECTIONS OF LAW: IPC 420, 120-B, IT ACT 66-D, PMLA SEC 3/4

SUSPECT INTELLIGENCE:
1. Accused: {random.choice(suspect_1["aliases"])} (Canonical: {suspect_1["name"]})
   Alias: {suspect_1["aliases"][-1]}
   Phone: {suspect_1["phone"]}
   Account: {suspect_1["account"]}
   Role: Kingpin / Syndicate Lead

2. Accused: {random.choice(suspect_2["aliases"])} (Canonical: {suspect_2["name"]})
   Alias: {suspect_2["aliases"][1] if len(suspect_2["aliases"]) > 1 else suspect_2["name"]}
   Phone: {suspect_2["phone"]}
   Account: {suspect_2["account"]}
   Role: Financial Mule Coordinator

3. Associate: {random.choice(assoc_1["aliases"])} (Canonical: {assoc_1["name"]})
   Phone: {assoc_1["phone"]}
   Role: Regional Dispatcher

FACTS:
Intelligence confirmed structured fund layering between accounts {suspect_1["account"]} and {suspect_2["account"]} alongside high-frequency telecom communications with {assoc_1["phone"]}.
"""
    with open("FIR_Case_992.txt", "w", encoding="utf-8") as f:
        f.write(fir_content)
    print("[+] Generated FIR_Case_992.txt")
    print("[OK] Compact, unified syndicate dataset generated successfully!")


if __name__ == "__main__":
    build_and_save_dataset()
