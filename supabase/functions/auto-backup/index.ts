import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-backup function started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if automatic backup is needed
    const { data: shouldBackup, error: checkError } = await supabase
      .rpc('should_create_automatic_backup');

    if (checkError) {
      console.error('Error checking backup status:', checkError);
      throw checkError;
    }

    if (!shouldBackup) {
      console.log('Automatic backup not needed - recent backup exists');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Backup not needed - recent backup exists',
          skipped: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log('Creating automatic backup...');

    // Create automatic backup
    const { data: backupId, error: backupError } = await supabase
      .rpc('create_database_backup', {
        backup_type: 'automatic',
        backup_method: 'incremental'
      });

    if (backupError) {
      console.error('Error creating backup:', backupError);
      throw backupError;
    }

    console.log('Automatic backup created successfully:', backupId);

    // Export data to JSON format for storage
    const tables = ['students', 'users', 'classes', 'registration_payments', 
                   'attendance', 'fees', 'student_enrollments', 'grade_levels', 
                   'subjects', 'grade_transitions', 'backup_logs'];
    
    const backupData: any = {
      timestamp: new Date().toISOString(),
      backup_id: backupId,
      type: 'automatic',
      method: 'incremental',
      tables: {}
    };

    let totalRecords = 0;

    // Get data from each table
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(`Error fetching ${table}:`, error);
          continue;
        }

        backupData.tables[table] = data;
        totalRecords += data?.length || 0;
        console.log(`Backed up ${data?.length || 0} records from ${table}`);
      } catch (err) {
        console.error(`Failed to backup table ${table}:`, err);
      }
    }

    // Store backup file in storage
    const fileName = `backup-${new Date().toISOString().split('T')[0]}-${backupId}.json`;
    const backupContent = JSON.stringify(backupData, null, 2);
    
    const { error: uploadError } = await supabase.storage
      .from('system-backups')
      .upload(fileName, new Blob([backupContent], { type: 'application/json' }));

    if (uploadError) {
      console.error('Error uploading backup file:', uploadError);
    } else {
      console.log(`Backup file stored: ${fileName}`);
      
      // Update backup log with file information
      const { error: updateError } = await supabase
        .from('backup_logs')
        .update({
          file_path: fileName,
          file_size: backupContent.length,
          records_count: totalRecords
        })
        .eq('id', backupId);

      if (updateError) {
        console.error('Error updating backup log:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automatic backup completed successfully',
        backup_id: backupId,
        records_count: totalRecords,
        file_name: fileName
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Auto-backup function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});