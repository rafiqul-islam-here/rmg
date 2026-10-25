"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import {
  fetcher,
  paths,
  type MyWork,
  type OrderFilters,
} from "./client";
import type {
  ActivityEvent,
  Buyer,
  DashboardSummary,
  FactoryProfile,
  NotificationSettings,
  Order,
  Paged,
  ReportKey,
  ReportResult,
  User,
} from "@/lib/types";

const opts = { fetcher, revalidateOnFocus: false, keepPreviousData: true } as const;

export const useOrders = (f: OrderFilters = {}) => useSWR<Paged<Order>>(paths.orders(f), opts);
export const useOrder = (id: string | null) => useSWR<Order>(id ? paths.order(id) : null, opts);
export const useOrderActivity = (id: string | null) => useSWR<Paged<ActivityEvent>>(id ? paths.orderActivity(id) : null, opts);
export const useActivity = (limit = 20) => useSWR<Paged<ActivityEvent>>(paths.activity(limit), opts);
export const useNotifications = () => useSWR<Paged<ActivityEvent>>(paths.notifications, { ...opts, refreshInterval: 60_000 });
export const useDashboard = () => useSWR<DashboardSummary>(paths.dashboard, opts);
export const useMyWork = () => useSWR<MyWork>(paths.myWork, opts);
export const useReport = (key: ReportKey) => useSWR<ReportResult>(paths.report(key), opts);
export const useBuyers = () => useSWR<Paged<Buyer>>(paths.buyers, opts);
export const useUsers = () => useSWR<Paged<User>>(paths.users, opts);
export const useFactory = () => useSWR<FactoryProfile>(paths.factory, opts);
export const useNotificationSettings = () => useSWR<NotificationSettings>(paths.notificationSettings, opts);

/** After any write, refresh every cached query (orders, counts, activity…). */
export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate(() => true), [mutate]);
}
