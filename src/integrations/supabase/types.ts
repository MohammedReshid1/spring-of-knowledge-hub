export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string
          class_id: string | null
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          attendance_date?: string
          class_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status: string
          student_id?: string | null
        }
        Update: {
          attendance_date?: string
          class_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          class_name: string
          created_at: string
          current_enrollment: number
          grade_level_id: string | null
          id: string
          max_capacity: number
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string
          class_name: string
          created_at?: string
          current_enrollment?: number
          grade_level_id?: string | null
          id?: string
          max_capacity?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string
          class_name?: string
          created_at?: string
          current_enrollment?: number
          grade_level_id?: string | null
          id?: string
          max_capacity?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          due_date: string
          fee_type: string
          id: string
          paid_date: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          academic_year?: string
          amount: number
          created_at?: string
          due_date: string
          fee_type: string
          id?: string
          paid_date?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          due_date?: string
          fee_type?: string
          id?: string
          paid_date?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_levels: {
        Row: {
          academic_year: string
          created_at: string
          current_enrollment: number
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          max_capacity: number
          updated_at: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          current_enrollment?: number
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_capacity?: number
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          current_enrollment?: number
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_capacity?: number
          updated_at?: string
        }
        Relationships: []
      }
      grade_transitions: {
        Row: {
          academic_year: string
          created_at: string | null
          id: string
          notes: string | null
          performed_by: string | null
          students_graduated: number
          students_transitioned: number
          transition_date: string
        }
        Insert: {
          academic_year: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          students_graduated?: number
          students_transitioned?: number
          transition_date?: string
        }
        Update: {
          academic_year?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          students_graduated?: number
          students_transitioned?: number
          transition_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_transitions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_mode: {
        Row: {
          created_at: string
          id: number
          name: string | null
          payment_data: Json | null
          payment_id: string
          payment_type: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          payment_data?: Json | null
          payment_id: string
          payment_type?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          payment_data?: Json | null
          payment_id?: string
          payment_type?: string | null
        }
        Relationships: []
      }
      registration_payments: {
        Row: {
          academic_year: string | null
          amount_paid: number | null
          created_at: string | null
          id: string
          notes: string | null
          payment_cycle: string
          payment_date: string | null
          payment_details: Json | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          student_id: string | null
          total_amount: number | null
          transaction_data: Json | null
          updated_at: string | null
        }
        Insert: {
          academic_year?: string | null
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_cycle?: string
          payment_date?: string | null
          payment_details?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          student_id?: string | null
          total_amount?: number | null
          transaction_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: string | null
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_cycle?: string
          payment_date?: string | null
          payment_details?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          student_id?: string | null
          total_amount?: number | null
          transaction_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payment_mode"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "registration_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          academic_year: string
          enrolled_at: string
          id: string
          student_id: string | null
          subject_id: string | null
        }
        Insert: {
          academic_year?: string
          enrolled_at?: string
          id?: string
          student_id?: string | null
          subject_id?: string | null
        }
        Update: {
          academic_year?: string
          enrolled_at?: string
          id?: string
          student_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          class_id: string | null
          created_at: string
          current_class: string | null
          current_section: string | null
          date_of_birth: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          father_name: string | null
          first_name: string
          gender: string | null
          grade_level: Database["public"]["Enums"]["grade_level"]
          grandfather_name: string | null
          id: string
          last_name: string
          medical_info: string | null
          mother_name: string | null
          parent_guardian_id: string | null
          phone: string | null
          phone_secondary: string | null
          photo_url: string | null
          previous_school: string | null
          status: Database["public"]["Enums"]["student_status"] | null
          student_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          class_id?: string | null
          created_at?: string
          current_class?: string | null
          current_section?: string | null
          date_of_birth: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          father_name?: string | null
          first_name: string
          gender?: string | null
          grade_level: Database["public"]["Enums"]["grade_level"]
          grandfather_name?: string | null
          id?: string
          last_name: string
          medical_info?: string | null
          mother_name?: string | null
          parent_guardian_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          previous_school?: string | null
          status?: Database["public"]["Enums"]["student_status"] | null
          student_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          class_id?: string | null
          created_at?: string
          current_class?: string | null
          current_section?: string | null
          date_of_birth?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          father_name?: string | null
          first_name?: string
          gender?: string | null
          grade_level?: Database["public"]["Enums"]["grade_level"]
          grandfather_name?: string | null
          id?: string
          last_name?: string
          medical_info?: string | null
          mother_name?: string | null
          parent_guardian_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          previous_school?: string | null
          status?: Database["public"]["Enums"]["student_status"] | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_guardian_id_fkey"
            columns: ["parent_guardian_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          grade_levels: Database["public"]["Enums"]["grade_level"][]
          id: string
          subject_code: string
          subject_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grade_levels: Database["public"]["Enums"]["grade_level"][]
          id?: string
          subject_code: string
          subject_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grade_levels?: Database["public"]["Enums"]["grade_level"][]
          id?: string
          subject_code?: string
          subject_name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cleanup_table: {
        Args: { table_name: string }
        Returns: number
      }
      create_auth_user_and_profile: {
        Args: {
          user_email: string
          user_password: string
          user_full_name: string
          user_role?: Database["public"]["Enums"]["user_role"]
          user_phone?: string
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_grade_level: {
        Args: { current_grade: Database["public"]["Enums"]["grade_level"] }
        Returns: Database["public"]["Enums"]["grade_level"]
      }
      log_grade_transition: {
        Args: {
          p_academic_year: string
          p_students_transitioned: number
          p_students_graduated: number
          p_notes?: string
        }
        Returns: string
      }
      preview_grade_transition: {
        Args: Record<PropertyKey, never>
        Returns: {
          student_id: string
          student_name: string
          current_grade: Database["public"]["Enums"]["grade_level"]
          next_grade: Database["public"]["Enums"]["grade_level"]
          action: string
        }[]
      }
      should_perform_grade_transition: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      transition_students_to_next_grade: {
        Args: Record<PropertyKey, never>
        Returns: {
          student_id: string
          old_grade: Database["public"]["Enums"]["grade_level"]
          new_grade: Database["public"]["Enums"]["grade_level"]
          status: string
        }[]
      }
    }
    Enums: {
      grade_level:
        | "pre_k"
        | "kindergarten"
        | "grade_1"
        | "grade_2"
        | "grade_3"
        | "grade_4"
        | "grade_5"
        | "grade_6"
        | "grade_7"
        | "grade_8"
        | "grade_9"
        | "grade_10"
        | "grade_11"
        | "grade_12"
      student_status:
        | "Active"
        | "Graduated"
        | "Transferred Out"
        | "Dropped Out"
        | "On Leave"
      user_role:
        | "admin"
        | "teacher"
        | "parent"
        | "student"
        | "super_admin"
        | "registrar"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      grade_level: [
        "pre_k",
        "kindergarten",
        "grade_1",
        "grade_2",
        "grade_3",
        "grade_4",
        "grade_5",
        "grade_6",
        "grade_7",
        "grade_8",
        "grade_9",
        "grade_10",
        "grade_11",
        "grade_12",
      ],
      student_status: [
        "Active",
        "Graduated",
        "Transferred Out",
        "Dropped Out",
        "On Leave",
      ],
      user_role: [
        "admin",
        "teacher",
        "parent",
        "student",
        "super_admin",
        "registrar",
      ],
    },
  },
} as const
